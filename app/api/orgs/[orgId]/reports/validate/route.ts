export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import {
  getFrameworkValidation,
  type FrameworkCheckResult,
  type ReportValidationInput,
} from "@/lib/validation/report-frameworks";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string }> };

const validateReportSchema = z.object({
  snapshotId: z.string().min(1),
  reportType: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    // All roles except field_worker may trigger validation
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const body = validateReportSchema.parse(await req.json());
    const { snapshotId, reportType } = body;

    // Verify snapshot belongs to this org and fetch the associated reporting period
    const snapshot = await prisma.publishedSnapshot.findFirst({
      where: { id: snapshotId, organizationId: orgId },
      select: { id: true, reportingPeriodId: true, organizationId: true },
    });
    if (!snapshot) {
      return apiError("NOT_FOUND", "Snapshot not found.", 404);
    }

    const { reportingPeriodId } = snapshot;

    // Gather the data needed for framework validation in parallel
    const [dashboardAggregates, activityRecordStats, energyRecordCount, facilityCount] =
      await Promise.all([
        // Scope-level aggregates for this snapshot (no facility/category breakdown)
        prisma.dashboardAggregate.findMany({
          where: {
            organizationId: orgId,
            snapshotId,
            emissionCategoryId: null,
            facilityId: null,
            businessUnitId: null,
          },
          select: { scope: true, totalCo2e: true, recordCount: true },
        }),

        // Category-level record counts + review status counts for this period
        prisma.activityRecord.groupBy({
          by: ["reviewStatus"],
          where: { organizationId: orgId, reportingPeriodId },
          _count: { id: true },
        }),

        // Check for energy records (kWh units)
        prisma.activityRecord.count({
          where: {
            organizationId: orgId,
            reportingPeriodId,
            unit: { in: ["kWh", "kwh", "KWH"] },
          },
        }),

        // Facility count for this org
        prisma.facility.count({
          where: { organizationId: orgId },
        }),
      ]);

    // Also fetch category-level record counts
    const categoryAggregates = await prisma.activityRecord.groupBy({
      by: ["emissionCategoryId"],
      where: { organizationId: orgId, reportingPeriodId },
      _count: { id: true },
    });

    // Fetch category codes for the grouped records
    const categoryIds = categoryAggregates
      .map((r) => r.emissionCategoryId)
      .filter((id): id is string => id !== null);

    const categories = categoryIds.length
      ? await prisma.emissionCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, code: true },
        })
      : [];

    const categoryIdToCode = new Map(categories.map((c) => [c.id, c.code]));

    const categoryRecordCounts = categoryAggregates
      .filter((r) => r.emissionCategoryId !== null)
      .map((r) => ({
        categoryCode: categoryIdToCode.get(r.emissionCategoryId!) ?? r.emissionCategoryId!,
        count: r._count.id,
      }));

    // Compute total and approved record counts
    const totalRecords = activityRecordStats.reduce((sum, g) => sum + g._count.id, 0);
    const approvedRecords =
      activityRecordStats.find((g) => g.reviewStatus === "approved")?._count.id ?? 0;

    const scopeTotals = dashboardAggregates.map((agg) => ({
      scope: agg.scope,
      totalCo2e: Number(agg.totalCo2e),
      recordCount: agg.recordCount,
    }));

    const validationInput: ReportValidationInput = {
      snapshotId,
      orgId,
      reportingPeriodId,
      scopeTotals,
      categoryRecordCounts,
      hasEnergyRecords: energyRecordCount > 0,
      hasFacilities: facilityCount > 0,
      totalRecords,
      approvedRecords,
    };

    const frameworkValidation = getFrameworkValidation(reportType);
    const checks: FrameworkCheckResult[] = frameworkValidation.validate(validationInput);

    const blockingFailures = checks.filter((r) => !r.passed && r.check.required);
    const valid = blockingFailures.length === 0;

    return NextResponse.json({ valid, checks, blockingFailures });
  } catch (err) {
    return handleRouteError(err);
  }
}
