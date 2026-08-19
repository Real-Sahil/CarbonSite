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

    // Gather the data needed for framework validation in parallel.
    // Scope/category presence uses LIVE ActivityRecord counts so that records
    // added after the snapshot was published are still recognised. CO2e totals
    // still come from DashboardAggregate (snapshot-bound) for accuracy.
    const [dashboardAggregates, activityRecordStats, energyRecordCount, facilityCount, liveRecords] =
      await Promise.all([
        // Snapshot CO2e totals only (scope-level, no breakdown)
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

        // Review-status counts for the reporting period (live)
        prisma.activityRecord.groupBy({
          by: ["reviewStatus"],
          where: { organizationId: orgId, reportingPeriodId },
          _count: { id: true },
        }),

        // Energy records (kWh units) — live
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

        // Live records with their emission category (scope + code) for presence checks
        prisma.activityRecord.findMany({
          where: { organizationId: orgId, reportingPeriodId },
          select: {
            emissionCategoryId: true,
            emissionCategory: { select: { scope: true, code: true } },
          },
        }),
      ]);

    // Build live scope record counts (records present in the period right now)
    const liveScopeMap = new Map<number, number>();
    for (const r of liveRecords) {
      const scope = r.emissionCategory?.scope;
      if (scope != null) liveScopeMap.set(scope, (liveScopeMap.get(scope) ?? 0) + 1);
    }

    // Build live category record counts
    const liveCategoryMap = new Map<string, number>();
    for (const r of liveRecords) {
      const code = r.emissionCategory?.code;
      if (code) liveCategoryMap.set(code, (liveCategoryMap.get(code) ?? 0) + 1);
    }

    const categoryRecordCounts = Array.from(liveCategoryMap.entries()).map(([categoryCode, count]) => ({
      categoryCode,
      count,
    }));

    // Compute total and approved record counts (live)
    const totalRecords = activityRecordStats.reduce((sum, g) => sum + g._count.id, 0);
    const approvedRecords =
      activityRecordStats.find((g) => g.reviewStatus === "approved")?._count.id ?? 0;

    // scopeTotals: live recordCount for presence checks, snapshot CO2e for totals
    const snapshotCo2eByScope = new Map(
      dashboardAggregates.map((a) => [a.scope, Number(a.totalCo2e)])
    );
    const allScopes = new Set([
      ...Array.from(liveScopeMap.keys()),
      ...dashboardAggregates.map((a) => a.scope),
    ]);
    const scopeTotals = Array.from(allScopes).map((scope) => ({
      scope,
      totalCo2e: snapshotCo2eByScope.get(scope) ?? 0,
      recordCount: liveScopeMap.get(scope) ?? 0,
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
