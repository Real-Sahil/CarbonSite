/**
 * Waste KPIs the way contractors report them: tonnes per 100k of value, and the
 * share diverted from landfill (recycling plus energy recovery, the same split
 * as the register and ESRS E5). Pure maths first, then one loader.
 *
 * The denominator is stated, never guessed: the period's revenue for the
 * organisation, the contract's value for a project, and only when that value is
 * in the organisation's reporting currency. With none, the per-100k figure is
 * absent and the tonnes and diversion still show.
 */
import { prisma } from "@/lib/db";
import { wasteHierarchyOf } from "./hierarchy";

export type KpiRow = { tonnes: number; route: string };
export type WasteKpi = {
  tonnes: number;
  divertedPct: number | null;
  perHundredK: number | null;
  /** What the per-100k figure divides by, or why there is none. */
  basis: string;
};

export function wasteKpi(rows: KpiRow[], value: number | null, basis: string): WasteKpi {
  const tonnes = rows.reduce((t, r) => t + r.tonnes, 0);
  const diverted = rows.filter((r) => wasteHierarchyOf(r.route) !== "landfill").reduce((t, r) => t + r.tonnes, 0);
  return {
    tonnes,
    divertedPct: tonnes > 0 ? (diverted / tonnes) * 100 : null,
    perHundredK: value != null && value > 0 ? tonnes / (value / 100_000) : null,
    basis: value != null && value > 0 ? basis : `${basis}: not entered`,
  };
}

export type WasteKpiSet = {
  currency: string;
  company: (WasteKpi & { label: string }) | null;
  projects: (WasteKpi & { id: string; name: string })[];
};

export async function loadWasteKpis(orgId: string, currency: string): Promise<WasteKpiSet> {
  const [records, periods, projects] = await Promise.all([
    prisma.wasteRecord.findMany({
      where: { organizationId: orgId },
      take: 20000,
      select: { projectId: true, reportingPeriodId: true, weightTonnes: true, disposalRoute: true },
    }),
    prisma.reportingPeriod.findMany({ where: { organizationId: orgId }, orderBy: { endDate: "desc" }, select: { id: true, label: true, revenueAmount: true, revenueCurrency: true } }),
    prisma.project.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, contract: { select: { contractValue: true, currency: true } } },
    }),
  ]);
  const row = (r: (typeof records)[number]): KpiRow => ({ tonnes: Number(r.weightTonnes), route: r.disposalRoute });

  const latest = periods.find((p) => records.some((r) => r.reportingPeriodId === p.id));
  const company = latest
    ? {
        label: latest.label,
        ...wasteKpi(
          records.filter((r) => r.reportingPeriodId === latest.id).map(row),
          latest.revenueAmount != null && (!latest.revenueCurrency || latest.revenueCurrency === currency) ? Number(latest.revenueAmount) : null,
          `Revenue for ${latest.label}`,
        ),
      }
    : null;

  const out = projects
    .map((p) => {
      const mine = records.filter((r) => r.projectId === p.id);
      if (mine.length === 0) return null;
      const sameCurrency = p.contract?.currency === currency;
      const value = sameCurrency && p.contract?.contractValue != null ? Number(p.contract.contractValue) : null;
      return { id: p.id, name: p.name, ...wasteKpi(mine.map(row), value, `Contract value in ${currency}`) };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.tonnes - a.tonnes);

  return { currency, company, projects: out };
}
