// Data Lineage — track the source-to-calculation path for emissions records
// Enables auditors to navigate from dashboard numbers → calculations → source data → evidence files

import type { Prisma } from "@prisma/client";

export enum LineageNodeType {
  DASHBOARD_AGGREGATE = "dashboard_aggregate",
  PUBLISHED_SNAPSHOT = "published_snapshot",
  CALCULATION_RUN = "calculation_run",
  EMISSION_CALCULATION = "emission_calculation",
  ACTIVITY_RECORD = "activity_record",
  STAGED_ACTIVITY_RECORD = "staged_activity_record",
  IMPORT_BATCH = "import_batch",
  FIELD_SUBMISSION = "field_submission",
  EVIDENCE_FILE = "evidence_file",
  FACTOR_LIBRARY_ENTRY = "factor_library_entry",
}

export interface LineageNode {
  id: string;
  type: LineageNodeType;
  label: string; // Human-readable identifier (invoice number, meter ID, etc.)
  timestamp?: Date;
  organizationId: string;

  // Metadata specific to node type
  metadata: Record<string, unknown>;

  // Data quality signal
  quality?: {
    confidence: number; // 0-1
    uncertainty?: number; // ±% CO2e
    dataSource: "manual" | "automated" | "api" | "field" | "supplier";
  };
}

export interface LineageEdge {
  from: string; // Source node ID
  to: string; // Destination node ID
  relationship: "calculates_to" | "consists_of" | "sources_from" | "evidences" | "uses_factor";
  metadata?: Record<string, unknown>;
}

export class DataLineageGraph {
  nodes: Map<string, LineageNode> = new Map();
  edges: LineageEdge[] = [];

  /**
   * Add a node to the lineage graph
   */
  addNode(node: LineageNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Add an edge connecting two nodes
   */
  addEdge(edge: LineageEdge): void {
    this.edges.push(edge);
  }

  /**
   * Traverse lineage backwards: start from a dashboard aggregate and trace to source data
   * Returns a tree showing all contributing factors and evidence
   */
  getLineageTree(nodeId: string, maxDepth: number = 10): LineageTree {
    const visited = new Set<string>();
    const tree: LineageTree = {
      node: this.nodes.get(nodeId)!,
      children: [],
    };

    this.traverseBackward(nodeId, tree, visited, maxDepth);
    return tree;
  }

  private traverseBackward(
    nodeId: string,
    parentTree: LineageTree,
    visited: Set<string>,
    depth: number
  ): void {
    if (depth === 0 || visited.has(nodeId)) return;
    visited.add(nodeId);

    // Find all edges pointing to this node
    const incomingEdges = this.edges.filter((e) => e.to === nodeId);

    for (const edge of incomingEdges) {
      const sourceNode = this.nodes.get(edge.from);
      if (!sourceNode) continue;

      const childTree: LineageTree = {
        node: sourceNode,
        children: [],
        edgeRelationship: edge.relationship,
      };

      parentTree.children!.push(childTree);
      this.traverseBackward(edge.from, childTree, visited, depth - 1);
    }
  }

  /**
   * Get all nodes contributing to a calculation (forward traversal)
   */
  getContributingNodes(calculationId: string): Set<string> {
    const contributing = new Set<string>();
    const queue: string[] = [calculationId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (contributing.has(nodeId)) continue;
      contributing.add(nodeId);

      // Find nodes this one depends on
      const incomingEdges = this.edges.filter((e) => e.to === nodeId);
      for (const edge of incomingEdges) {
        queue.push(edge.from);
      }
    }

    return contributing;
  }

  /**
   * Detect data quality issues in lineage
   * (e.g., spend-based records, missing factors, unreviewed field submissions)
   */
  getQualityConcerns(nodeId: string): QualityConcern[] {
    const concerns: QualityConcern[] = [];
    const node = this.nodes.get(nodeId);
    if (!node) return concerns;

    // Low confidence
    if (node.quality?.confidence && node.quality.confidence < 0.7) {
      concerns.push({
        severity: "warning",
        type: "low_confidence",
        message: `Data quality confidence ${(node.quality.confidence * 100).toFixed(0)}% is below 70% threshold`,
        nodeId,
      });
    }

    // Spend-based (high uncertainty)
    if (node.quality?.dataSource === "manual" && node.type === LineageNodeType.ACTIVITY_RECORD) {
      concerns.push({
        severity: "info",
        type: "spend_based",
        message: "Spend-based record — recommend obtaining supplier data",
        nodeId,
      });
    }

    // Unreviewed field submission
    if (node.type === LineageNodeType.FIELD_SUBMISSION) {
      if ((node.metadata?.status as string) !== "approved") {
        concerns.push({
          severity: "warning",
          type: "unreviewed_submission",
          message: `Field submission status: ${node.metadata?.status}`,
          nodeId,
        });
      }
    }

    return concerns;
  }

  /**
   * Export lineage as JSON for visualization (e.g., Mermaid, D3.js)
   */
  toJSON(): { nodes: LineageNode[]; edges: LineageEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
    };
  }
}

export interface LineageTree {
  node: LineageNode;
  children?: LineageTree[];
  edgeRelationship?: string;
}

export interface QualityConcern {
  severity: "info" | "warning" | "error";
  type: string;
  message: string;
  nodeId: string;
}

/**
 * Helper: Build lineage graph from database queries
 * In production, this would be called from the calculation engine after a run completes
 */
export function buildLineageFromCalculation(
  calculation: {
    id: string;
    activityRecordId: string;
    co2eAmount: number;
    methodologyVersion: string;
    factorLibraryVersion: string;
  },
  activityRecord: {
    id: string;
    externalRecordId: string;
    emissionCategoryCode: string;
    organizationId: string;
    importBatchId?: string;
    fieldSubmissionId?: string;
    supplierName?: string;
  },
  importBatch?: { id: string; sourceFilename?: string },
  fieldSubmission?: { id: string; status: string }
): DataLineageGraph {
  const graph = new DataLineageGraph();

  // Add calculation node
  graph.addNode({
    id: calculation.id,
    type: LineageNodeType.EMISSION_CALCULATION,
    label: `Calculation ${calculation.id.substring(0, 8)}`,
    organizationId: activityRecord.organizationId,
    metadata: {
      co2eAmount: calculation.co2eAmount,
      methodology: calculation.methodologyVersion,
      factorLibrary: calculation.factorLibraryVersion,
    },
  });

  // Add activity record node
  graph.addNode({
    id: activityRecord.id,
    type: LineageNodeType.ACTIVITY_RECORD,
    label: activityRecord.externalRecordId,
    organizationId: activityRecord.organizationId,
    metadata: {
      category: activityRecord.emissionCategoryCode,
      supplier: activityRecord.supplierName,
    },
    quality: {
      confidence: 0.9,
      dataSource: activityRecord.fieldSubmissionId ? "field" : "automated",
    },
  });

  // Link calculation to activity record
  graph.addEdge({
    from: activityRecord.id,
    to: calculation.id,
    relationship: "calculates_to",
  });

  // Add import batch if present
  if (importBatch) {
    graph.addNode({
      id: importBatch.id,
      type: LineageNodeType.IMPORT_BATCH,
      label: importBatch.sourceFilename || `Batch ${importBatch.id.substring(0, 8)}`,
      organizationId: activityRecord.organizationId,
      metadata: { batchId: importBatch.id },
    });

    graph.addEdge({
      from: importBatch.id,
      to: activityRecord.id,
      relationship: "sources_from",
    });
  }

  // Add field submission if present
  if (fieldSubmission) {
    graph.addNode({
      id: fieldSubmission.id,
      type: LineageNodeType.FIELD_SUBMISSION,
      label: `Field Submission ${fieldSubmission.id.substring(0, 8)}`,
      organizationId: activityRecord.organizationId,
      metadata: { status: fieldSubmission.status },
      quality: {
        confidence: fieldSubmission.status === "approved" ? 0.95 : 0.5,
        dataSource: "field",
      },
    });

    graph.addEdge({
      from: fieldSubmission.id,
      to: activityRecord.id,
      relationship: "sources_from",
    });
  }

  return graph;
}
