// Server-side data access for the SBTi trajectory — separated from
// lib/calculation/sbti-trajectory.ts (which stays pure/DB-free) so both the
// /api/orgs/[orgId]/sbti route and the Decarbonization Pathway page can
// share the exact same "actual tCO2e per year" query rather than drifting
// into two slightly different implementations.

import { prisma } from "@/lib/db";
import {
  buildSbtiAlerts,
  buildSbtiTrajectory,
  type SbtiAlert,
  type SbtiTargetInput,
  type SbtiTrajectoryPoint,
} from "@/lib/calculation/sbti-trajectory";

/**
 * Actual reported tCO2e per calendar year, from the org's own reporting
 * periods — the "actual" the trajectory is checked against.
 *
 * Category-level DashboardAggregate rows only (facility/business-unit rows
 * slice the same emissions differently and would double count — see
 * computePeriodTotals in lib/inventory/base-year.ts, same convention).
 * A period's published snapshot is used when one exists; otherwise its
 * live (unpublished) aggregate stands in, same as computePeriodTotals.
 */
export async function actualTco2eByYear(
  orgId: string,
  fromYear: number,
  toYear: number,
): Promise<Map<number, number>> {
  const periods = await prisma.reportingPeriod.findMany({
    where: { organizationId: orgId },
    select: { id: true, startDate: true },
  });
  const periodsInRange = periods.filter((p) => {
    const year = p.startDate.getUTCFullYear();
    return year >= fromYear && year <= toYear;
  });
  if (periodsInRange.length === 0) return new Map();

  const periodIds = periodsInRange.map((p) => p.id);
  const snapshots = await prisma.publishedSnapshot.findMany({
    where: { organizationId: orgId, reportingPeriodId: { in: periodIds } },
    orderBy: [{ version: "desc" }, { publishedAt: "desc" }],
    select: { id: true, reportingPeriodId: true },
  });
  const latestSnapshotByPeriod = new Map<string, string>();
  for (const snapshot of snapshots) {
    if (!latestSnapshotByPeriod.has(snapshot.reportingPeriodId)) {
      latestSnapshotByPeriod.set(snapshot.reportingPeriodId, snapshot.id);
    }
  }

  const aggregates = await prisma.dashboardAggregate.findMany({
    where: {
      organizationId: orgId,
      reportingPeriodId: { in: periodIds },
      emissionCategoryId: { not: null },
      facilityId: null,
      businessUnitId: null,
    },
    select: { reportingPeriodId: true, snapshotId: true, totalCo2e: true },
  });

  const totalsByYear = new Map<number, number>();
  const yearByPeriod = new Map(periodsInRange.map((p) => [p.id, p.startDate.getUTCFullYear()]));
  for (const row of aggregates) {
    const expectedSnapshotId = latestSnapshotByPeriod.get(row.reportingPeriodId) ?? null;
    if (row.snapshotId !== expectedSnapshotId) continue;
    const year = yearByPeriod.get(row.reportingPeriodId);
    if (year === undefined) continue;
    totalsByYear.set(year, (totalsByYear.get(year) ?? 0) + Number(row.totalCo2e) / 1000);
  }
  return totalsByYear;
}

export interface SbtiPathwayResult {
  target: SbtiTargetInput & { pathway: string };
  trajectory: SbtiTrajectoryPoint[];
  alerts: SbtiAlert[];
}

/**
 * Loads the org's SbtiTarget (if any) and builds its full trajectory and
 * alerts against real actuals. Null when no target has been set yet.
 */
export async function loadSbtiPathway(orgId: string): Promise<SbtiPathwayResult | null> {
  const target = await prisma.sbtiTarget.findUnique({ where: { organizationId: orgId } });
  if (!target) return null;

  const input: SbtiTargetInput = {
    pathway: target.pathway,
    baseYear: target.baseYear,
    baselineScope1Tco2e: Number(target.baselineScope1Tco2e),
    baselineScope2Tco2e: Number(target.baselineScope2Tco2e),
    baselineScope3Tco2e: target.baselineScope3Tco2e != null ? Number(target.baselineScope3Tco2e) : null,
    nearTermYear: target.nearTermYear,
    nearTermReductionPct: Number(target.nearTermReductionPct),
    netZeroYear: target.netZeroYear,
    netZeroReductionPct: Number(target.netZeroReductionPct),
  };

  const currentYear = new Date().getFullYear();
  const actuals = await actualTco2eByYear(orgId, target.baseYear, Math.min(currentYear, target.netZeroYear));
  const trajectory = buildSbtiTrajectory(input, actuals);
  const alerts = buildSbtiAlerts(input, trajectory);

  return { target: input, trajectory, alerts };
}
