import { prisma } from "@/lib/db";
import { SCOPE_ROLLUP_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import type { CarbonPrice, ScopeTotal } from "./index";

export async function loadCarbonPrices(orgId: string): Promise<CarbonPrice[]> {
  const rows = await prisma.internalCarbonPrice.findMany({
    where: { organizationId: orgId },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    priceType: r.priceType,
    pricePerTonne: Number(r.pricePerTonne),
    currency: r.currency,
    scopes: r.scopes,
    appliesTo: r.appliesTo,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    basis: r.basis,
  }));
}

/**
 * Gross tCO2e by scope from the organisation's latest published snapshot
 * (location-based Scope 2, as in the headline), or null when nothing is
 * published. Used for the volume an E1-8 price covers.
 */
export async function latestPublishedScopeTotals(orgId: string): Promise<{ periodLabel: string; version: number; totals: ScopeTotal[] } | null> {
  const snapshot = await prisma.publishedSnapshot.findFirst({
    where: { organizationId: orgId },
    orderBy: [{ reportingPeriod: { endDate: "desc" } }, { version: "desc" }],
    select: { id: true, version: true, reportingPeriodId: true, reportingPeriod: { select: { label: true } } },
  });
  if (!snapshot) return null;
  const rows = await prisma.dashboardAggregate.groupBy({
    by: ["scope"],
    where: {
      organizationId: orgId,
      reportingPeriodId: snapshot.reportingPeriodId,
      snapshotId: snapshot.id,
      ...SCOPE_ROLLUP_DIMENSIONS,
      facilityId: null,
    },
    _sum: { totalCo2e: true },
  });
  return {
    periodLabel: snapshot.reportingPeriod.label,
    version: snapshot.version,
    totals: rows.map((r) => ({ scope: r.scope, tco2e: Number(r._sum.totalCo2e ?? 0) / 1000 })),
  };
}
