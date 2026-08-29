import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS, getSession } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import {
  getOperationStatus,
  cancelOperation,
  processBulkOperation,
} from "@/lib/operations/bulk-processor";
import { z } from "zod";

/**
 * GET /api/orgs/[orgId]/bulk-operations/[operationId]
 * Get status of a specific bulk operation.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; operationId: string }> }
) {
  try {
    const { orgId, operationId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const operation = getOperationStatus(operationId);

    if (!operation || operation.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Operation not found", 404);
    }

    return NextResponse.json({
      id: operation.id,
      type: operation.operationType,
      status: operation.status,
      totalCount: operation.totalCount,
      processedCount: operation.processedCount,
      failedCount: operation.failedCount,
      progress: Math.round((operation.processedCount / operation.totalCount) * 100),
      startedAt: operation.startedAt,
      completedAt: operation.completedAt,
      estimatedTimeRemaining:
        operation.status === "processing"
          ? Math.round(
              ((operation.totalCount - operation.processedCount) /
                (operation.processedCount || 1)) *
                (Date.now() - (operation.startedAt?.getTime() || 0))
            )
          : null,
      errors: operation.errors
        ? operation.errors.map((e) => ({
            recordId: e.recordId,
            error: e.error,
          }))
        : [],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * DELETE /api/orgs/[orgId]/bulk-operations/[operationId]
 * Cancel a queued bulk operation.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; operationId: string }> }
) {
  try {
    const { orgId, operationId } = await params;
    const session = await getSession();

    if (!session?.user?.id) {
      return apiError("UNAUTHORIZED", "Not authenticated", 401);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const operation = getOperationStatus(operationId);

    if (!operation || operation.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Operation not found", 404);
    }

    const cancelled = cancelOperation(operationId);

    if (!cancelled) {
      return apiError(
        "INVALID_STATE",
        "Cannot cancel operation that is not queued",
        400
      );
    }

    return NextResponse.json({
      success: true,
      message: "Operation cancelled",
      operationId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/orgs/[orgId]/bulk-operations/[operationId]/process
 * Trigger processing of a queued operation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; operationId: string }> }
) {
  try {
    const { orgId, operationId } = await params;
    const session = await getSession();

    if (!session?.user?.id) {
      return apiError("UNAUTHORIZED", "Not authenticated", 401);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const operation = getOperationStatus(operationId);

    if (!operation || operation.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Operation not found", 404);
    }

    // Process immediately (in production, this would queue for worker)
    const result = await processBulkOperation(operationId);

    if (!result.success) {
      return apiError("PROCESSING_ERROR", result.message, 500);
    }

    const updated = getOperationStatus(operationId);

    return NextResponse.json({
      success: true,
      message: result.message,
      operation: {
        id: updated!.id,
        status: updated!.status,
        processedCount: updated!.processedCount,
        failedCount: updated!.failedCount,
        completedAt: updated!.completedAt,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
