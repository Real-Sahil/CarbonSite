export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { Scope2Method } from "@prisma/client";

const bulkUpdateSchema = z.object({
  reportingPeriodId: z.string().min(1, "Reporting period ID required"),
  emissionCategoryIds: z.array(z.string()).optional(),
  scope2Method: z.enum(["location_based", "market_based"]),
  reviewStatusFilter: z
    .enum(["all", "approved", "in_review", "draft"])
    .optional()
    .default("all"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin",
      "sustainability_director",
      "sustainability_manager",
      "editor",
    );

    const body = bulkUpdateSchema.parse(await req.json());

    // Verify the period exists and belongs to this org
    const period = await prisma.reportingPeriod.findUnique({
      where: { id: body.reportingPeriodId, organizationId: orgId },
      include: { _count: { select: { activityRecords: true } } },
    });
    if (!period) return apiError("NOT_FOUND", "Reporting period not found.", 404);

    // Build the filter for records to update
    const whereClause: Parameters<typeof prisma.activityRecord.updateMany>[0]["where"] = {
      organizationId: orgId,
      reportingPeriodId: body.reportingPeriodId,
      emissionCategory: { scope: 2 },
    };

    if (body.emissionCategoryIds?.length) {
      whereClause.emissionCategoryId = { in: body.emissionCategoryIds };
    }

    if (body.reviewStatusFilter !== "all") {
      whereClause.reviewStatus = body.reviewStatusFilter;
    }

    // Count how many records will be updated
    const countBefore = await prisma.activityRecord.count({ where: whereClause });

    // Update the records
    const result = await prisma.activityRecord.updateMany({
      where: whereClause,
      data: {
        scope2Method: body.scope2Method as Scope2Method,
        updatedAt: new Date(),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.updated",
      resourceType: "ActivityRecord",
      resourceId: body.reportingPeriodId,
      metadata: {
        bulkUpdate: true,
        scope2Method: body.scope2Method,
        emissionCategoryIds: body.emissionCategoryIds,
        reviewStatusFilter: body.reviewStatusFilter,
        recordsUpdated: result.count,
        periodId: body.reportingPeriodId,
      },
    });

    return NextResponse.json({
      success: true,
      recordsUpdated: result.count,
      message: `${result.count} Scope 2 record${result.count !== 1 ? "s" : ""} updated to ${body.scope2Method}`,
      periodLabel: period.label,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
