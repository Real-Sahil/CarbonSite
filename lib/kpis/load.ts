import { prisma } from "@/lib/db";
import { addRecord, emptyAgg, sumAggs, type KpiAgg } from "./catalogue";

export type KpiRow = { key: string; name: string; level: "company" | "unit" | "project"; agg: KpiAgg };
export type KpiReportData = { periodId: string | null; periodLabel: string | null; periods: { id: string; label: string }[]; rows: KpiRow[] };

/**
 * One period's waste, rolled up for the company, each business unit and each
 * project. Values: the period's revenue for the company, contract value for a
 * project (only in the reporting currency), floor area from the project's
 * carbon budget. A unit adds up its own contracts (each counted once) and projects.
 */
export async function loadKpiReport(orgId: string, currency: string, periodId?: string | null): Promise<KpiReportData> {
  const periods = await prisma.reportingPeriod.findMany({ where: { organizationId: orgId }, orderBy: { endDate: "desc" }, select: { id: true, label: true, revenueAmount: true, revenueCurrency: true } });
  const withWaste = periodId && periods.some((p) => p.id === periodId)
    ? periodId
    : (await prisma.wasteRecord.findFirst({ where: { organizationId: orgId, reportingPeriodId: { in: periods.map((p) => p.id) } }, orderBy: { reportingPeriod: { endDate: "desc" } }, select: { reportingPeriodId: true } }))?.reportingPeriodId ?? null;
  const period = periods.find((p) => p.id === withWaste) ?? null;
  if (!period) return { periodId: null, periodLabel: null, periods: periods.map(({ id, label }) => ({ id, label })), rows: [] };

  const [records, projects, units] = await Promise.all([
    prisma.wasteRecord.findMany({
      where: { organizationId: orgId, reportingPeriodId: period.id },
      take: 50000,
      select: { projectId: true, weightTonnes: true, disposalRoute: true, hazardous: true, co2eTonnes: true },
    }),
    prisma.project.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, contractId: true, contract: { select: { contractValue: true, currency: true, businessUnitId: true } }, carbonBudget: { select: { floorAreaM2: true } } },
    }),
    prisma.businessUnit.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
  ]);

  const byProject = new Map<string | null, KpiAgg>();
  const company = emptyAgg();
  for (const r of records) {
    const rec = { tonnes: Number(r.weightTonnes), route: r.disposalRoute, hazardous: r.hazardous, co2eT: r.co2eTonnes != null ? Number(r.co2eTonnes) : null };
    addRecord(company, rec);
    const a = byProject.get(r.projectId) ?? emptyAgg();
    addRecord(a, rec);
    byProject.set(r.projectId, a);
  }
  company.value = period.revenueAmount != null && (!period.revenueCurrency || period.revenueCurrency === currency) ? Number(period.revenueAmount) : null;

  const rows: KpiRow[] = [{ key: "company", name: `Company, ${period.label}`, level: "company", agg: company }];

  // Business units: sum of their projects' waste; value = their contracts' values, each once.
  const unitName = new Map(units.map((u) => [u.id, u.name]));
  type UnitAcc = { aggs: KpiAgg[]; contracts: Map<string, number | null>; floor: number | null };
  const perUnit = new Map<string, UnitAcc>();
  const projectRows: KpiRow[] = [];
  for (const p of projects) {
    const agg = byProject.get(p.id);
    const sameCurrency = p.contract?.currency === currency;
    const value = sameCurrency && p.contract?.contractValue != null ? Number(p.contract.contractValue) : null;
    const floor = p.carbonBudget?.floorAreaM2 != null ? Number(p.carbonBudget.floorAreaM2) : null;
    const buId = p.contract?.businessUnitId;
    if (buId && unitName.has(buId)) {
      const u: UnitAcc = perUnit.get(buId) ?? { aggs: [], contracts: new Map(), floor: null };
      if (agg) u.aggs.push(agg);
      u.contracts.set(p.contractId, value);
      if (floor != null) u.floor = (u.floor ?? 0) + floor;
      perUnit.set(buId, u);
    }
    if (agg) projectRows.push({ key: p.id, name: p.name, level: "project", agg: { ...agg, value, floorM2: floor } });
  }
  for (const [id, u] of perUnit) {
    if (u.aggs.length === 0) continue;
    const agg = sumAggs(u.aggs);
    const vals = [...u.contracts.values()];
    agg.value = vals.length > 0 && vals.every((v) => v != null) ? vals.reduce<number>((t, v) => t + (v as number), 0) : null;
    agg.floorM2 = u.floor;
    rows.push({ key: `unit:${id}`, name: unitName.get(id)!, level: "unit", agg });
  }
  rows.push(...projectRows.sort((a, b) => b.agg.tonnes - a.agg.tonnes));
  const unassigned = byProject.get(null);
  if (unassigned) rows.push({ key: "none", name: "Not tied to a project", level: "project", agg: unassigned });
  return { periodId: period.id, periodLabel: period.label, periods: periods.map(({ id, label }) => ({ id, label })), rows };
}
