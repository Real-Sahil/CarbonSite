import { prisma } from "@/lib/db";
import { CATEGORY_BREAKDOWN_DIMENSIONS, SCOPE_ROLLUP_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import type { PeriodFacts } from "./draft-narrative";

/**
 * The figures of a period for wording: the latest published snapshot's (what a
 * report is built from), else the live aggregates. Null when the period is not
 * this organisation's or has nothing calculated.
 */
export async function loadPeriodFacts(orgId: string, periodId: string): Promise<PeriodFacts | null> {
  const period = await prisma.reportingPeriod.findFirst({ where: { id: periodId, organizationId: orgId }, select: { id: true, label: true } });
  if (!period) return null;
  const snap = await prisma.publishedSnapshot.findFirst({
    where: { organizationId: orgId, reportingPeriodId: period.id },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  const base = { organizationId: orgId, reportingPeriodId: period.id, snapshotId: snap?.id ?? null };
  const [scopeRows, categoryRows] = await Promise.all([
    prisma.dashboardAggregate.findMany({
      where: { ...base, ...SCOPE_ROLLUP_DIMENSIONS, facilityId: null },
      select: { scope: true, totalCo2e: true },
    }),
    prisma.dashboardAggregate.findMany({
      where: { ...base, ...CATEGORY_BREAKDOWN_DIMENSIONS },
      select: { totalCo2e: true, emissionCategory: { select: { name: true } } },
      orderBy: { totalCo2e: "desc" },
      take: 5,
    }),
  ]);
  const scopes = [1, 2, 3].map((scope) => ({ scope, kg: scopeRows.filter((r) => r.scope === scope).reduce((t, r) => t + Number(r.totalCo2e), 0) })).filter((s) => s.kg > 0);
  const totalKg = scopes.reduce((t, s) => t + s.kg, 0);
  if (totalKg <= 0) return null;
  return {
    label: period.label,
    totalKg,
    scopes,
    categories: categoryRows.map((r) => ({ name: r.emissionCategory?.name ?? "Uncategorised", kg: Number(r.totalCo2e) })),
  };
}
