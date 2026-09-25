import { prisma } from "@/lib/db";
import { CATEGORY_BREAKDOWN_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import { defaultRunInputs } from "@/lib/calculation/default-run-inputs";
import { PPN_SCOPE3_CATEGORIES, scopeTotalsFromRollup } from "@/lib/bids/carbon-pack";
import type { CrpContext } from "./plan";

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

/**
 * Everything the guided plan shows beside the form, read from the
 * organisation's own records for the plan's period. Every query is scoped to
 * the organisation. Returns null when the period is not the organisation's.
 */
export async function loadCrpContext(orgId: string, reportingPeriodId: string): Promise<CrpContext | null> {
  const period = await prisma.reportingPeriod.findFirst({
    where: { id: reportingPeriodId, organizationId: orgId },
    select: { id: true, label: true, startDate: true, endDate: true },
  });
  if (!period) return null;

  const recordWhere = { organizationId: orgId, reportingPeriodId };
  const [byScope, approved, latestRun, snapshot, baseYear, initiatives, runDefaults] = await Promise.all([
    prisma.activityRecord.groupBy({
      by: ["emissionCategoryId"],
      where: recordWhere,
      _count: { _all: true },
    }),
    prisma.activityRecord.count({ where: { ...recordWhere, reviewStatus: "approved" } }),
    prisma.calculationRun.findFirst({
      where: { organizationId: orgId, reportingPeriodId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, finishedAt: true },
    }),
    prisma.publishedSnapshot.findFirst({
      where: { organizationId: orgId, reportingPeriodId },
      orderBy: { publishedAt: "desc" },
      select: { id: true, version: true, publishedAt: true, calculationRunId: true, verificationStatus: true },
    }),
    prisma.baseYear.findFirst({
      where: { organizationId: orgId, status: { in: ["active", "draft"] } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { reportingPeriod: { select: { label: true, endDate: true } } },
    }),
    prisma.reductionInitiative.findMany({
      where: { organizationId: orgId, status: { not: "canceled" } },
      select: { name: true, status: true, expectedImpactCo2e: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    defaultRunInputs(orgId, reportingPeriodId),
  ]);

  const categoryScopes = await prisma.emissionCategory.findMany({
    where: { id: { in: byScope.map((r) => r.emissionCategoryId) } },
    select: { id: true, scope: true },
  });
  const scopeOf = new Map(categoryScopes.map((c) => [c.id, c.scope]));
  const counts: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  for (const r of byScope) {
    const sc = scopeOf.get(r.emissionCategoryId) as 1 | 2 | 3 | undefined;
    if (sc) counts[sc] += r._count._all;
  }

  let totals: NonNullable<CrpContext["snapshot"]>["totals"] = { s1: 0, s2: 0, s2Market: null, s3: 0, total: 0 };
  const categoryTonnes = new Map<string, number>();
  if (snapshot) {
    const [rollup, cats] = await Promise.all([
      prisma.dashboardAggregate.findMany({
        where: { organizationId: orgId, snapshotId: snapshot.id, emissionCategoryId: null, facilityId: null, businessUnitId: null },
        select: { snapshotId: true, scope: true, scope2Method: true, totalCo2e: true },
      }),
      prisma.dashboardAggregate.findMany({
        where: { organizationId: orgId, snapshotId: snapshot.id, ...CATEGORY_BREAKDOWN_DIMENSIONS },
        select: { totalCo2e: true, emissionCategory: { select: { code: true } } },
      }),
    ]);
    totals = scopeTotalsFromRollup(rollup);
    for (const c of cats) {
      const code = c.emissionCategory?.code;
      if (code) categoryTonnes.set(code, (categoryTonnes.get(code) ?? 0) + Number(c.totalCo2e) / 1000);
    }
  }

  const unpublishedRun =
    !!latestRun && latestRun.status === "succeeded" && !!snapshot && latestRun.id !== snapshot.calculationRunId;

  return {
    period,
    records: { total: counts[1] + counts[2] + counts[3], approved, byScope: counts },
    latestRun,
    snapshot: snapshot
      ? {
          id: snapshot.id,
          version: snapshot.version,
          publishedAt: snapshot.publishedAt,
          calculationRunId: snapshot.calculationRunId,
          reviewStatus: snapshot.verificationStatus,
          totals,
        }
      : null,
    unpublishedRun,
    ppnScope3: PPN_SCOPE3_CATEGORIES.map((c) => ({ code: c.code, label: c.label, tonnes: categoryTonnes.get(c.code) ?? null })),
    baseYear: baseYear
      ? {
          id: baseYear.id,
          label: baseYear.label,
          status: baseYear.status,
          periodLabel: baseYear.reportingPeriod.label,
          endYear: baseYear.reportingPeriod.endDate.getUTCFullYear(),
          s1: num(baseYear.currentScope1Co2e ?? baseYear.originalScope1Co2e),
          s2: num(baseYear.currentScope2Co2e ?? baseYear.originalScope2Co2e),
          s3: num(baseYear.currentScope3Co2e ?? baseYear.originalScope3Co2e),
          total: num(baseYear.currentTotalCo2e ?? baseYear.originalTotalCo2e),
        }
      : null,
    initiatives: initiatives.map((i) => ({
      name: i.name,
      status: i.status,
      expectedTonnes: i.expectedImpactCo2e != null ? Number(i.expectedImpactCo2e) / 1000 : null,
    })),
    runDefaults,
  };
}
