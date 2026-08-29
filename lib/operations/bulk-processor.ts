import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";

export interface BulkOperation {
  id: string;
  organizationId: string;
  operationType: "review" | "categorize" | "export" | "calculate" | "delete";
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  totalCount: number;
  processedCount: number;
  failedCount: number;
  startedAt?: Date;
  completedAt?: Date;
  recordIds: string[];
  parameters: Record<string, any>;
  errors?: Array<{ recordId: string; error: string }>;
}

// In-memory operation store (use database in production)
const operationStore = new Map<string, BulkOperation>();

/**
 * Create a bulk operation to review/approve records in batch.
 */
export async function createBulkReviewOperation(
  organizationId: string,
  recordIds: string[],
  action: "approve" | "reject" | "request_info",
  reason?: string,
  userId?: string
): Promise<BulkOperation> {
  // Validate all records exist and belong to org
  const records = await prisma.activityRecord.findMany({
    where: {
      id: { in: recordIds },
      organizationId,
    },
  });

  if (records.length !== recordIds.length) {
    throw new Error("Some records not found or do not belong to this organization");
  }

  const operationId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const operation: BulkOperation = {
    id: operationId,
    organizationId,
    operationType: "review",
    status: "queued",
    totalCount: recordIds.length,
    processedCount: 0,
    failedCount: 0,
    recordIds,
    parameters: {
      action,
      reason,
    },
  };

  operationStore.set(operationId, operation);

  // Audit log
  if (userId) {
    await writeAuditLog({
      organizationId,
      action: "bulk.review_queued",
      actorUserId: userId,
      resourceType: "bulk_operation",
      resourceId: operationId,
      metadata: {
        count: recordIds.length,
        action,
      },
    });
  }

  return operation;
}

/**
 * Create bulk categorization operation.
 */
export async function createBulkCategorizeOperation(
  organizationId: string,
  recordIds: string[],
  categoryId: string,
  userId?: string
): Promise<BulkOperation> {
  // Validate category exists
  const category = await prisma.emissionCategory.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    throw new Error("Category not found");
  }

  // Validate records
  const records = await prisma.activityRecord.findMany({
    where: {
      id: { in: recordIds },
      organizationId,
    },
  });

  if (records.length !== recordIds.length) {
    throw new Error("Some records not found");
  }

  const operationId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const operation: BulkOperation = {
    id: operationId,
    organizationId,
    operationType: "categorize",
    status: "queued",
    totalCount: recordIds.length,
    processedCount: 0,
    failedCount: 0,
    recordIds,
    parameters: {
      categoryId,
      categoryName: category.name,
    },
  };

  operationStore.set(operationId, operation);

  if (userId) {
    await writeAuditLog({
      organizationId,
      action: "bulk.categorize_queued",
      actorUserId: userId,
      resourceType: "bulk_operation",
      resourceId: operationId,
      metadata: {
        count: recordIds.length,
        categoryId,
      },
    });
  }

  return operation;
}

/**
 * Process a bulk operation.
 */
export async function processBulkOperation(
  operationId: string
): Promise<{ success: boolean; message: string }> {
  const operation = operationStore.get(operationId);
  if (!operation) {
    return { success: false, message: "Operation not found" };
  }

  operation.status = "processing";
  operation.startedAt = new Date();

  const errors: Array<{ recordId: string; error: string }> = [];

  try {
    for (const recordId of operation.recordIds) {
      try {
        if (operation.operationType === "review") {
          const newStatus =
            operation.parameters.action === "approve"
              ? "approved"
              : operation.parameters.action === "reject"
                ? "rejected"
                : "pending_info";

          await prisma.activityRecord.update({
            where: { id: recordId },
            data: { reviewStatus: newStatus },
          });
        } else if (operation.operationType === "categorize") {
          await prisma.activityRecord.update({
            where: { id: recordId },
            data: { emissionCategoryId: operation.parameters.categoryId },
          });
        }

        operation.processedCount++;
      } catch (error) {
        operation.failedCount++;
        errors.push({
          recordId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    operation.status = "completed";
    operation.completedAt = new Date();
    operation.errors = errors.length > 0 ? errors : undefined;

    console.log(
      `[Bulk Operation] ${operationId} completed: ${operation.processedCount} processed, ${operation.failedCount} failed`
    );

    return {
      success: true,
      message: `Processed ${operation.processedCount} records, ${operation.failedCount} failed`,
    };
  } catch (error) {
    operation.status = "failed";
    operation.completedAt = new Date();
    console.error(`[Bulk Operation] ${operationId} failed:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get operation status.
 */
export function getOperationStatus(operationId: string): BulkOperation | null {
  return operationStore.get(operationId) ?? null;
}

/**
 * Cancel a queued operation.
 */
export function cancelOperation(operationId: string): boolean {
  const operation = operationStore.get(operationId);
  if (!operation || operation.status !== "queued") {
    return false;
  }

  operation.status = "cancelled";
  console.log(`[Bulk Operation] ${operationId} cancelled`);
  return true;
}

/**
 * Get all operations for an organization.
 */
export function getOrgOperations(
  organizationId: string,
  filter?: { status?: BulkOperation["status"] }
): BulkOperation[] {
  return Array.from(operationStore.values()).filter((op) => {
    if (op.organizationId !== organizationId) return false;
    if (filter?.status && op.status !== filter.status) return false;
    return true;
  });
}

/**
 * Cleanup old operations (older than 7 days).
 */
export function cleanupOldOperations(): number {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const toDelete: string[] = [];

  for (const [id, op] of operationStore.entries()) {
    if (op.completedAt && op.completedAt < cutoff) {
      toDelete.push(id);
    }
  }

  toDelete.forEach((id) => operationStore.delete(id));
  console.log(`[Bulk Operation] Cleaned up ${toDelete.length} old operations`);
  return toDelete.length;
}

/**
 * Get operation statistics.
 */
export function getOperationStats(organizationId?: string) {
  const operations = organizationId
    ? getOrgOperations(organizationId)
    : Array.from(operationStore.values());

  return {
    total: operations.length,
    byStatus: {
      queued: operations.filter((o) => o.status === "queued").length,
      processing: operations.filter((o) => o.status === "processing").length,
      completed: operations.filter((o) => o.status === "completed").length,
      failed: operations.filter((o) => o.status === "failed").length,
      cancelled: operations.filter((o) => o.status === "cancelled").length,
    },
    byType: {
      review: operations.filter((o) => o.operationType === "review").length,
      categorize: operations.filter((o) => o.operationType === "categorize").length,
      export: operations.filter((o) => o.operationType === "export").length,
      calculate: operations.filter((o) => o.operationType === "calculate").length,
      delete: operations.filter((o) => o.operationType === "delete").length,
    },
    totalRecordsProcessed: operations.reduce((sum, o) => sum + o.processedCount, 0),
    totalRecordsFailed: operations.reduce((sum, o) => sum + o.failedCount, 0),
  };
}
