import { prisma } from "@/lib/db";
import { CATEGORY_BREAKDOWN_DIMENSIONS, SCOPE_ROLLUP_DIMENSIONS } from "@/lib/calculation/aggregate-filters";

export interface LiveTotals {
  aggregates: {
    totalCo2e: number;
    scope1: number;
    scope2: number;
    scope3: number;
    byCategory: Record<string, number>;
  };
  timestamp: string;
  calculationRunId: string;
}

/// Live (unpublished) totals in kg for the organisation's latest reporting
/// period, read from DashboardAggregate with the same filters as the
/// dashboard headline: location-based Scope 2, snapshot copies excluded.
/// Null when there is no period or no successful calculation run yet.
export async function loadLiveTotals(organizationId: string): Promise<LiveTotals | null> {
  const period = await prisma.reportingPeriod.findFirst({
    where: { organizationId },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (!period) return null;

  const run = await prisma.calculationRun.findFirst({
    where: { organizationId, reportingPeriodId: period.id, status: "succeeded" },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, finishedAt: true, createdAt: true },
  });
  if (!run) return null;

  const live = { organizationId, reportingPeriodId: period.id, snapshotId: null };
  const [byScope, byCategory] = await Promise.all([
    prisma.dashboardAggregate.groupBy({
      by: ["scope"],
      where: { ...live, ...SCOPE_ROLLUP_DIMENSIONS, facilityId: null },
      _sum: { totalCo2e: true },
    }),
    prisma.dashboardAggregate.findMany({
      where: { ...live, ...CATEGORY_BREAKDOWN_DIMENSIONS },
      select: { totalCo2e: true, emissionCategory: { select: { code: true } } },
    }),
  ]);

  const scope = (s: number) => Number(byScope.find((r) => r.scope === s)?._sum.totalCo2e ?? 0);
  const categories: Record<string, number> = {};
  for (const row of byCategory) {
    const code = row.emissionCategory?.code;
    if (code) categories[code] = (categories[code] ?? 0) + Number(row.totalCo2e);
  }

  return {
    aggregates: {
      totalCo2e: scope(1) + scope(2) + scope(3),
      scope1: scope(1),
      scope2: scope(2),
      scope3: scope(3),
      byCategory: categories,
    },
    timestamp: (run.finishedAt ?? run.createdAt).toISOString(),
    calculationRunId: run.id,
  };
}
