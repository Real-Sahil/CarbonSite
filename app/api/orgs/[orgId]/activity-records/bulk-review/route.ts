import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

// Bulk review for activity records — makes large imports and legacy draft
// records manageable without clicking through thousands of rows.
// Either an explicit id list, or every record in a given review status for
// a period (optionally scoped to one import batch).
const bulkReviewRecordsSchema = z
  .object({
    reviewStatus: z.enum(["approved", "rejected", "in_review"]),
    ids: z.array(z.string().cuid()).min(1).max(500).optional(),
    filter: z
      .object({
        reportingPeriodId: z.string().min(1),
        currentStatus: z.enum(["draft", "in_review"]).default("draft"),
        importBatchId: z.string().optional(),
      })
      .optional(),
  })
  .refine((data) => Boolean(data.ids) !== Boolean(data.filter), {
    message: "Provide either ids or filter, not both.",
    path: ["ids"],
  });

type Params = { params: Promise<{ orgId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const body = bulkReviewRecordsSchema.parse(await req.json());

    const where = body.ids
      ? { organizationId: orgId, id: { in: body.ids } }
      : {
          organizationId: orgId,
          reportingPeriodId: body.filter!.reportingPeriodId,
          reviewStatus: body.filter!.currentStatus,
          ...(body.filter!.importBatchId
            ? { importBatchId: body.filter!.importBatchId }
            : {}),
        };

    const result = await prisma.activityRecord.updateMany({
      where,
      data: { reviewStatus: body.reviewStatus },
    });

    if (result.count === 0) {
      return apiError("NOT_FOUND", "No matching records to review.", 404);
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.reviewed",
      resourceType: "activity_record",
      resourceId: body.filter?.importBatchId ?? body.filter?.reportingPeriodId ?? "bulk",
      metadata: {
        bulk: true,
        reviewStatus: body.reviewStatus,
        count: result.count,
        ...(body.ids ? { ids: body.ids } : { filter: body.filter }),
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch (err) {
    return handleRouteError(err);
  }
}
