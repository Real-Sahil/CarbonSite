import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS, getSession } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import {
  createBulkReviewOperation,
  createBulkCategorizeOperation,
  getOrgOperations,
  getOperationStats,
} from "@/lib/operations/bulk-processor";
import { z } from "zod";

const reviewSchema = z.object({
  recordIds: z.array(z.string()).min(1),
  action: z.enum(["approve", "reject", "request_info"]),
  reason: z.string().max(500).optional(),
});

const categorizeSchema = z.object({
  recordIds: z.array(z.string()).min(1),
  categoryId: z.string(),
});

/**
 * GET /api/orgs/[orgId]/bulk-operations
 * List all bulk operations for the organization.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const status = request.nextUrl.searchParams.get("status") as any;

    const operations = getOrgOperations(orgId, { status });
    const stats = getOperationStats(orgId);

    return NextResponse.json({
      operations: operations.map((op) => ({
        id: op.id,
        type: op.operationType,
        status: op.status,
        totalCount: op.totalCount,
        processedCount: op.processedCount,
        failedCount: op.failedCount,
        progress: Math.round((op.processedCount / op.totalCount) * 100),
        startedAt: op.startedAt,
        completedAt: op.completedAt,
        errors: op.errors?.slice(0, 5), // Limit to first 5 errors
      })),
      stats,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/orgs/[orgId]/bulk-operations/review
 * Create a bulk review operation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSession();

    if (!session?.user?.id) {
      return apiError("UNAUTHORIZED", "Not authenticated", 401);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.reviewer);

    const pathname = request.nextUrl.pathname;
    const isReviewEndpoint = pathname.includes("/review");
    const isCategorizeEndpoint = pathname.includes("/categorize");

    if (isReviewEndpoint) {
      const body = reviewSchema.parse(await request.json());

      const operation = await createBulkReviewOperation(
        orgId,
        body.recordIds,
        body.action,
        body.reason,
        session.user.id
      );

      return NextResponse.json(
        {
          id: operation.id,
          status: operation.status,
          totalCount: operation.totalCount,
          message: `Bulk review operation created for ${operation.totalCount} records`,
        },
        { status: 202 }
      );
    } else if (isCategorizeEndpoint) {
      const body = categorizeSchema.parse(await request.json());

      const operation = await createBulkCategorizeOperation(
        orgId,
        body.recordIds,
        body.categoryId,
        session.user.id
      );

      return NextResponse.json(
        {
          id: operation.id,
          status: operation.status,
          totalCount: operation.totalCount,
          message: `Bulk categorization operation created for ${operation.totalCount} records`,
        },
        { status: 202 }
      );
    }

    return apiError("BAD_REQUEST", "Unknown operation type", 400);
  } catch (error) {
    return handleRouteError(error);
  }
}
