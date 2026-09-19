import { prisma } from "@/lib/db";

// Shared Prisma where-fragments for reading DashboardAggregate.
//
// rebuildDashboardAggregates() in run-worker.ts writes the SAME calculations
// into several rows, one per breakdown dimension:
//   - a scope rollup row       (emissionCategoryId/facilityId/businessUnitId all null)
//   - a per-category row       (emissionCategoryId set)
//   - a per-facility row       (facilityId set, when the record has one)
//   - a per-business-unit row  (businessUnitId set, when the record has one)
// and, for Scope 2, one of each per reporting method.
//
// A read that does not pin the dimensions it wants therefore sums the same CO2e
// two to four times. Import these instead of hand-writing the nulls.

/// GHG Protocol dual reporting keeps location-based and market-based Scope 2
/// apart and never sums them; the headline inventory uses location-based.
/// Scope 1 and 3 rows carry no method, so both cases are admitted explicitly —
/// `{ not: "market_based" }` compiles to `<> 'market_based'`, which evaluates to
/// NULL for the method-less rows and silently drops Scope 1 and 3 entirely.
export const PRIMARY_SCOPE2_METHOD = {
  OR: [{ scope2Method: null }, { scope2Method: "location_based" as const }],
};

/// Non-facility dimensions pinned, for scope-level totals. Callers set
/// `facilityId` themselves: `null` for org-wide rollup rows, or an `in` filter
/// to scope the total to a contract's facilities.
export const SCOPE_ROLLUP_DIMENSIONS = {
  emissionCategoryId: null,
  businessUnitId: null,
  ...PRIMARY_SCOPE2_METHOD,
};

/// One row per emission category, deduplicated across Scope 2 methods.
export const CATEGORY_BREAKDOWN_DIMENSIONS = {
  emissionCategoryId: { not: null },
  facilityId: null,
  businessUnitId: null,
  ...PRIMARY_SCOPE2_METHOD,
};

/// One row per facility, deduplicated across Scope 2 methods.
export const FACILITY_BREAKDOWN_DIMENSIONS = {
  emissionCategoryId: null,
  businessUnitId: null,
  facilityId: { not: null },
  ...PRIMARY_SCOPE2_METHOD,
};

/// Total live CO2e (kg) for one organization and one reporting period, with the
/// breakdown dimensions pinned and published-snapshot copies excluded.
///
/// Anything comparing organizations or periods must go through this. Summing
/// DashboardAggregate with only an organizationId adds every dimension row,
/// every reporting period and every published snapshot's frozen copy together,
/// which overstates by a multiple that grows each time a snapshot is published.
export async function periodLiveCo2e(
  organizationId: string,
  reportingPeriodId: string,
): Promise<number> {
  const agg = await prisma.dashboardAggregate.aggregate({
    where: {
      organizationId,
      reportingPeriodId,
      snapshotId: null,
      ...SCOPE_ROLLUP_DIMENSIONS,
      facilityId: null,
    },
    _sum: { totalCo2e: true },
  });
  return Number(agg._sum.totalCo2e ?? 0);
}

/// Total live CO2e (kg) for an organization's most recent reporting period that
/// starts on or before `onOrBefore` (defaults to the latest period outright).
/// Returns null when the organization has no such period, which callers must
/// treat as "no comparable figure" rather than zero emissions.
export async function latestPeriodLiveCo2e(
  organizationId: string,
  onOrBefore?: Date,
): Promise<number | null> {
  const period = await prisma.reportingPeriod.findFirst({
    where: {
      organizationId,
      ...(onOrBefore ? { startDate: { lte: onOrBefore } } : {}),
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (!period) return null;
  return periodLiveCo2e(organizationId, period.id);
}
