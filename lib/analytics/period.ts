import { prisma } from "@/lib/db";

export type AnalyticsPeriod = { id: string; startDate: Date; endDate: Date };

/**
 * The reporting period the analytics page reads: the newest one, chosen the
 * same way as the dashboard (latest start date, then latest created), so the
 * two pages describe the same period. Null when the organisation has none.
 */
export async function loadAnalyticsPeriod(orgId: string): Promise<AnalyticsPeriod | null> {
  return prisma.reportingPeriod.findFirst({
    where: { organizationId: orgId },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, startDate: true, endDate: true },
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
