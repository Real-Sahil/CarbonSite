import { describe, it, expect } from "vitest";
import {
  DataLineageGraph,
  LineageNodeType,
  buildLineageFromCalculation,
} from "../data-lineage";

describe("Data Lineage", () => {
  it("should add nodes to the lineage graph", () => {
    const graph = new DataLineageGraph();

    graph.addNode({
      id: "node-1",
      type: LineageNodeType.ACTIVITY_RECORD,
      label: "Invoice INV-001",
      organizationId: "org-123",
      metadata: { category: "s1-mobile" },
    });

    expect(graph.nodes.size).toBe(1);
    expect(graph.nodes.get("node-1")).toBeDefined();
    expect(graph.nodes.get("node-1")?.label).toBe("Invoice INV-001");
  });

  it("should add edges connecting nodes", () => {
    const graph = new DataLineageGraph();

    graph.addNode({
      id: "source",
      type: LineageNodeType.ACTIVITY_RECORD,
      label: "Source",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addNode({
      id: "calculation",
      type: LineageNodeType.EMISSION_CALCULATION,
      label: "Calculation",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addEdge({
      from: "source",
      to: "calculation",
      relationship: "calculates_to",
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe("source");
    expect(graph.edges[0].to).toBe("calculation");
  });

  it("should traverse lineage backward from a node", () => {
    const graph = new DataLineageGraph();

    // Setup: ImportBatch → ActivityRecord → Calculation
    graph.addNode({
      id: "batch",
      type: LineageNodeType.IMPORT_BATCH,
      label: "Import Batch",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addNode({
      id: "record",
      type: LineageNodeType.ACTIVITY_RECORD,
      label: "Activity Record",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addNode({
      id: "calc",
      type: LineageNodeType.EMISSION_CALCULATION,
      label: "Calculation",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addEdge({
      from: "batch",
      to: "record",
      relationship: "sources_from",
    });

    graph.addEdge({
      from: "record",
      to: "calc",
      relationship: "calculates_to",
    });

    const tree = graph.getLineageTree("calc", 10);

    expect(tree.node.id).toBe("calc");
    expect(tree.children).toHaveLength(1);
    expect(tree.children![0].node.id).toBe("record");
    expect(tree.children![0].children).toHaveLength(1);
    expect(tree.children![0].children![0].node.id).toBe("batch");
  });

  it("should get all contributing nodes", () => {
    const graph = new DataLineageGraph();

    // Chain: Batch → Record1 → Calc1 → Dashboard
    //        Record2 → Calc2 ↗
    graph.addNode({
      id: "batch",
      type: LineageNodeType.IMPORT_BATCH,
      label: "Batch",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addNode({
      id: "rec1",
      type: LineageNodeType.ACTIVITY_RECORD,
      label: "Record 1",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addNode({
      id: "rec2",
      type: LineageNodeType.ACTIVITY_RECORD,
      label: "Record 2",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addNode({
      id: "calc1",
      type: LineageNodeType.EMISSION_CALCULATION,
      label: "Calc 1",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addNode({
      id: "calc2",
      type: LineageNodeType.EMISSION_CALCULATION,
      label: "Calc 2",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addNode({
      id: "dashboard",
      type: LineageNodeType.DASHBOARD_AGGREGATE,
      label: "Dashboard",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addEdge({ from: "batch", to: "rec1", relationship: "sources_from" });
    graph.addEdge({ from: "rec1", to: "calc1", relationship: "calculates_to" });
    graph.addEdge({ from: "rec2", to: "calc2", relationship: "calculates_to" });
    graph.addEdge({ from: "calc1", to: "dashboard", relationship: "consists_of" });
    graph.addEdge({ from: "calc2", to: "dashboard", relationship: "consists_of" });

    const contributing = graph.getContributingNodes("dashboard");

    expect(contributing.size).toBe(6); // All nodes
    expect(contributing.has("batch")).toBe(true);
    expect(contributing.has("rec1")).toBe(true);
    expect(contributing.has("rec2")).toBe(true);
    expect(contributing.has("calc1")).toBe(true);
    expect(contributing.has("calc2")).toBe(true);
  });

  it("should detect quality concerns in lineage", () => {
    const graph = new DataLineageGraph();

    // Low confidence node
    graph.addNode({
      id: "node1",
      type: LineageNodeType.ACTIVITY_RECORD,
      label: "Record",
      organizationId: "org-123",
      metadata: {},
      quality: { confidence: 0.6, dataSource: "automated" },
    });

    // Spend-based node
    graph.addNode({
      id: "node2",
      type: LineageNodeType.ACTIVITY_RECORD,
      label: "Spend Record",
      organizationId: "org-123",
      metadata: {},
      quality: { confidence: 0.8, dataSource: "manual" },
    });

    // Unreviewed field submission
    graph.addNode({
      id: "node3",
      type: LineageNodeType.FIELD_SUBMISSION,
      label: "Field Submission",
      organizationId: "org-123",
      metadata: { status: "pending" },
    });

    const concerns1 = graph.getQualityConcerns("node1");
    expect(concerns1.some((c) => c.type === "low_confidence")).toBe(true);

    const concerns2 = graph.getQualityConcerns("node2");
    expect(concerns2.some((c) => c.type === "spend_based")).toBe(true);

    const concerns3 = graph.getQualityConcerns("node3");
    expect(concerns3.some((c) => c.type === "unreviewed_submission")).toBe(true);
  });

  it("should export lineage as JSON", () => {
    const graph = new DataLineageGraph();

    graph.addNode({
      id: "n1",
      type: LineageNodeType.ACTIVITY_RECORD,
      label: "Node 1",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addNode({
      id: "n2",
      type: LineageNodeType.EMISSION_CALCULATION,
      label: "Node 2",
      organizationId: "org-123",
      metadata: {},
    });

    graph.addEdge({
      from: "n1",
      to: "n2",
      relationship: "calculates_to",
    });

    const json = graph.toJSON();

    expect(json.nodes).toHaveLength(2);
    expect(json.edges).toHaveLength(1);
    expect(json.edges[0].relationship).toBe("calculates_to");
  });

  it("should build lineage from calculation data", () => {
    const calculation = {
      id: "calc-1",
      activityRecordId: "rec-1",
      co2eAmount: 150.5,
      methodologyVersion: "ghg-v2",
      factorLibraryVersion: "defra-2025",
    };

    const activityRecord = {
      id: "rec-1",
      externalRecordId: "INV-001",
      emissionCategoryCode: "s1-mobile",
      organizationId: "org-123",
      importBatchId: "batch-1",
      supplierName: "Fuel Supplier",
    };

    const importBatch = {
      id: "batch-1",
      sourceFilename: "xero-export-2026-08-25.csv",
    };

    const graph = buildLineageFromCalculation(
      calculation,
      activityRecord,
      importBatch
    );

    expect(graph.nodes.size).toBe(3);
    expect(graph.edges).toHaveLength(2);

    // Verify nodes exist
    expect(graph.nodes.has("calc-1")).toBe(true);
    expect(graph.nodes.has("rec-1")).toBe(true);
    expect(graph.nodes.has("batch-1")).toBe(true);

    // Verify edges
    const edges = graph.toJSON().edges;
    expect(edges.some((e) => e.from === "rec-1" && e.to === "calc-1")).toBe(true);
    expect(edges.some((e) => e.from === "batch-1" && e.to === "rec-1")).toBe(true);
  });

  it("should handle field submissions in lineage", () => {
    const calculation = {
      id: "calc-1",
      activityRecordId: "rec-1",
      co2eAmount: 100,
      methodologyVersion: "ghg-v2",
      factorLibraryVersion: "defra-2025",
    };

    const activityRecord = {
      id: "rec-1",
      externalRecordId: "FIELD-001",
      emissionCategoryCode: "s1-mobile",
      organizationId: "org-123",
      fieldSubmissionId: "field-1",
    };

    const fieldSubmission = {
      id: "field-1",
      status: "approved",
    };

    const graph = buildLineageFromCalculation(
      calculation,
      activityRecord,
      undefined,
      fieldSubmission
    );

    expect(graph.nodes.size).toBe(3);

    const fieldNode = graph.nodes.get("field-1");
    expect(fieldNode?.type).toBe(LineageNodeType.FIELD_SUBMISSION);
    expect(fieldNode?.quality?.confidence).toBe(0.95); // High confidence for approved
  });
});
