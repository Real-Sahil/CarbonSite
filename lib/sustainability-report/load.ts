// Reads what the annual sustainability report prints. The carbon evidence
// (history, base year, targets, measures, assurance, signatory) comes from the
// bid pack loader, which already reads published snapshots only; this adds the
// period's revenue for intensity, waste, social value and the organisation's
// own Scope 3 notes.

import { prisma } from "@/lib/db";
import { loadBidPackData, type BidPackData } from "@/lib/bids/carbon-pack";
import { parseSections } from "@/lib/crp/plan";
import { wasteHierarchyOf } from "@/lib/waste/hierarchy";
import {
  highlights,
  intensity,
  scope3Disclosure,
  wasteSummary,
  yearTable,
  type Intensity,
  type Scope3Row,
  type Tile,
  type Waste,
  type YearRow,
} from "./model";

export type SustainabilityReportData = {
  orgName: string;
  pack: BidPackData;
  tiles: Tile[];
  years: YearRow[];
  intensity: Intensity | null;
  scope3: Scope3Row[];
  waste: Waste | null;
  socialValue: { totalPounds: number; byTheme: { name: string; pounds: number }[] } | null;
  boundary: { approach: string; sites: string; exclusions: { item: string; reason: string }[] } | null;
};

const BOUNDARY_LABELS: Record<string, string> = {
  operational_control: "Operational control",
  financial_control: "Financial control",
  equity_share: "Equity share",
};

export async function loadSustainabilityReport(orgId: string, snapshotId: string): Promise<SustainabilityReportData> {
  const pack = await loadBidPackData(orgId, snapshotId, {});
  const snap = await prisma.publishedSnapshot.findFirst({
    where: { id: snapshotId, organizationId: orgId },
    select: {
      reportingPeriodId: true,
      reportingPeriod: { select: { revenueAmount: true, revenueCurrency: true, fteCount: true } },
    },
  });
  if (!snap) throw Object.assign(new Error("Snapshot not found."), { code: "NOT_FOUND", status: 404 });
  const periodId = snap.reportingPeriodId;

  const [wasteRows, svRows, periodPlan] = await Promise.all([
    prisma.wasteRecord.findMany({
      where: { organizationId: orgId, reportingPeriodId: periodId },
      select: { weightTonnes: true, disposalRoute: true },
    }),
    prisma.socialValueRecord.findMany({
      where: { organizationId: orgId, reportingPeriodId: periodId },
      select: { valuePounds: true, measure: { select: { theme: { select: { name: true } } } } },
    }),
    prisma.carbonReductionPlan.findFirst({ where: { organizationId: orgId, reportingPeriodId: periodId }, select: { sections: true } }),
  ]);
  const plan = periodPlan
    ?? (await prisma.carbonReductionPlan.findFirst({ where: { organizationId: orgId }, orderBy: { updatedAt: "desc" }, select: { sections: true } }));
  const sections = plan ? parseSections(plan.sections) : null;

  const rev = snap.reportingPeriod;
  const inten = intensity(
    pack.current.total,
    pack.current.s1 + pack.current.s2,
    rev.revenueAmount != null && rev.revenueCurrency ? { amount: Number(rev.revenueAmount), currency: rev.revenueCurrency } : null,
    rev.fteCount != null ? Number(rev.fteCount) : null,
  );
  const waste = wasteSummary(
    wasteRows.map((w) => ({ tonnes: Number(w.weightTonnes), diverted: wasteHierarchyOf(w.disposalRoute) !== "landfill" })),
  );

  const themes = new Map<string, number>();
  for (const r of svRows) {
    const name = r.measure.theme.name;
    themes.set(name, (themes.get(name) ?? 0) + Number(r.valuePounds));
  }
  const socialValue = pack.socialValuePounds > 0
    ? { totalPounds: pack.socialValuePounds, byTheme: [...themes].map(([name, pounds]) => ({ name, pounds })).sort((a, b) => b.pounds - a.pounds) }
    : null;

  const top = pack.categories[0];
  return {
    orgName: pack.orgName,
    pack,
    tiles: highlights({
      periodLabel: pack.snapshot.periodLabel,
      current: pack.current,
      baseYear: pack.baseYear,
      intensity: inten,
      waste,
      socialValuePounds: pack.socialValuePounds,
      topCategory: top ? { name: top.name, tonnes: top.tonnes } : null,
    }),
    years: yearTable(pack.baseYear, pack.history, pack.current, pack.snapshot.periodLabel),
    intensity: inten,
    scope3: scope3Disclosure(pack.categories, sections?.scope3 ?? []),
    waste,
    socialValue,
    boundary: sections
      ? {
          approach: BOUNDARY_LABELS[sections.organisation.boundaryApproach] ?? sections.organisation.boundaryApproach,
          sites: sections.organisation.sitesIncluded,
          exclusions: sections.organisation.exclusions.map((e) => ({ item: e.item, reason: e.reason })),
        }
      : null,
  };
}
