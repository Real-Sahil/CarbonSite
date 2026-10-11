import { prisma } from "@/lib/db";
import { SCOPE_ROLLUP_DIMENSIONS } from "@/lib/calculation/aggregate-filters";

export type AnalyticsPeriod = { id: string; startDate: Date; endDate: Date };

const NEWEST_FIRST = [{ startDate: "desc" as const }, { createdAt: "desc" as const }];
const PERIOD_SELECT = { id: true, startDate: true, endDate: true } as const;

/**
 * The reporting period the analytics pages and the dashboard read: the newest
 * period that has live scope rollup rows, so a new period with no calculation
 * yet does not blank every chart. Falls back to the newest period at all (so the
 * page can say which period is empty). Null when the organisation has none.
 */
export async function loadAnalyticsPeriod(orgId: string): Promise<AnalyticsPeriod | null> {
  const withRows = await prisma.reportingPeriod.findFirst({
    where: {
      organizationId: orgId,
      aggregates: { some: { snapshotId: null, ...SCOPE_ROLLUP_DIMENSIONS, facilityId: null } },
    },
    orderBy: NEWEST_FIRST,
    select: PERIOD_SELECT,
  });
  if (withRows) return withRows;
  return prisma.reportingPeriod.findFirst({
    where: { organizationId: orgId },
    orderBy: NEWEST_FIRST,
    select: PERIOD_SELECT,
  });
}

/**
 * Start of the trend window. Without `days` the whole period is shown; with it,
 * the last `days` days of the period (anchored at the period end, not today, so
 * a period that ended months ago still has data), never before the period start.
 */
export function trendWindowStart(period: { startDate: Date; endDate: Date }, days: number | null): Date {
  if (days === null) return period.startDate;
  const from = new Date(period.endDate);
  from.setUTCDate(from.getUTCDate() - days);
  return from > period.startDate ? from : period.startDate;
}

/** Parses the `days` query value: a whole number from 1 to 366, or null when absent or invalid. */
export function parseTrendDays(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 1), 366);
}
