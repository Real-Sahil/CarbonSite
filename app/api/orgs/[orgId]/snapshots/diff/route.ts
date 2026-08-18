export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const url = new URL(req.url);
    const fromSnapshotId = url.searchParams.get("fromSnapshotId");
    const toCalculationRunId = url.searchParams.get("toCalculationRunId");

    if (!fromSnapshotId || !toCalculationRunId) {
      return apiError(
        "MISSING_PARAMS",
        "fromSnapshotId and toCalculationRunId are required.",
        400,
      );
    }

    // Verify the snapshot and run both belong to this org
    const [snapshot, run] = await Promise.all([
      prisma.publishedSnapshot.findFirst({
        where: { id: fromSnapshotId, organizationId: orgId },
        select: { id: true, version: true, reportingPeriodId: true },
      }),
      prisma.calculationRun.findFirst({
        where: { id: toCalculationRunId, organizationId: orgId },
        select: { id: true, reportingPeriodId: true, status: true },
      }),
    ]);

    if (!snapshot) {
      return apiError("NOT_FOUND", "Published snapshot not found.", 404);
    }
    if (!run) {
      return apiError("NOT_FOUND", "Calculation run not found.", 404);
    }

    // Load DashboardAggregate rows for the existing published snapshot
    // Group by scope only (no facility/category breakdown for the summary diff)
    const fromAggregates = await prisma.dashboardAggregate.findMany({
      where: {
        organizationId: orgId,
        snapshotId: fromSnapshotId,
        emissionCategoryId: null,
        facilityId: null,
        businessUnitId: null,
      },
      select: { scope: true, totalCo2e: true, recordCount: true },
    });

    // Load EmissionCalculation rows for the new run grouped by scope
    const toCalculations = await prisma.emissionCalculation.findMany({
      where: {
        organizationId: orgId,
        calculationRunId: toCalculationRunId,
      },
      select: {
        totalCo2e: true,
        activityRecord: {
          select: {
            emissionCategory: { select: { scope: true } },
          },
        },
      },
    });

    // Aggregate "to" totals by scope
    const toScopeMap = new Map<number, number>();
    for (const calc of toCalculations) {
      const scope = calc.activityRecord.emissionCategory.scope;
      toScopeMap.set(scope, (toScopeMap.get(scope) ?? 0) + Number(calc.totalCo2e));
    }

    // Build "from" scope map from dashboard aggregates
    const fromScopeMap = new Map<number, number>();
    for (const agg of fromAggregates) {
      fromScopeMap.set(agg.scope, Number(agg.totalCo2e));
    }

    // Build per-scope diff rows for scopes 1, 2, 3
    const scopeDiffs = [1, 2, 3].map((scope) => {
      const fromCo2e = fromScopeMap.get(scope) ?? 0;
      const toCo2e = toScopeMap.get(scope) ?? 0;
      const delta = toCo2e - fromCo2e;
      const deltaPercent = fromCo2e === 0 ? null : (delta / fromCo2e) * 100;
      return { scope, fromCo2e, toCo2e, delta, deltaPercent };
    });

    const totalFrom = scopeDiffs.reduce((sum, r) => sum + r.fromCo2e, 0);
    const totalTo = scopeDiffs.reduce((sum, r) => sum + r.toCo2e, 0);
    const totalDelta = totalTo - totalFrom;
    const totalDeltaPercent = totalFrom === 0 ? null : (totalDelta / totalFrom) * 100;

    return NextResponse.json({
      fromSnapshotVersion: snapshot.version,
      scopeDiffs,
      totalFrom,
      totalTo,
      totalDelta,
      totalDeltaPercent,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
