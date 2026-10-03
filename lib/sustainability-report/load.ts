// Reads what the annual sustainability report prints. The carbon evidence
// (history, base year, targets, measures, assurance, signatory) comes from the
// bid pack loader, which already reads published snapshots only; this adds the
// period's revenue for intensity, waste, social value and the organisation's
// own Scope 3 notes.

import { prisma } from "@/lib/db";
import { loadBidPackData, type BidPackData } from "@/lib/bids/carbon-pack";
import { parseSections } from "@/lib/crp/plan";
import { wasteHierarchyOf } from "@/lib/waste/hierarchy";
import { formatters, orgFormat, type OrgFormat } from "@/lib/i18n/org-format";
import { normalizeUnit } from "@/lib/calculation/units";
import { materialByStandard } from "@/lib/materiality";
import {
  fleetSummary,
  fuelSummary,
  highlights,
  intensity,
  perMillion,
  waterSummary,
  scope3Disclosure,
  wasteSummary,
  yearTable,
  type Intensity,
  type Scope3Row,
  type Tile,
  type Fleet,
  type Fuel,
  type Waste,
  type Water,
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
  /** Tonnes of waste per million of revenue. */
  wasteIntensity: number | null;
  fuel: Fuel | null;
  /** The fleet by powertrain on the last day of the period, from the fleet register. */
  fleet: Fleet | null;
  water: (Water & { withdrawalPerMillion: number | null }) | null;
  socialValue: { totalPounds: number; byTheme: { name: string; pounds: number }[] } | null;
  boundary: { approach: string; sites: string; exclusions: { item: string; reason: string }[] } | null;
  /** The latest approved or published materiality assessment, with its material topics. */
  materiality: {
    name: string;
    status: string;
    approvedAt: Date | null;
    method: string | null;
    stakeholders: string | null;
    groups: ReturnType<typeof materialByStandard>;
  } | null;
  /** The organisation's locale and reporting currency. */
  format: OrgFormat;
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
      reportingPeriod: { select: { revenueAmount: true, revenueCurrency: true, fteCount: true, endDate: true } },
      organization: { select: { hqCountry: true, reportingCurrency: true } },
    },
  });
  if (!snap) throw Object.assign(new Error("Snapshot not found."), { code: "NOT_FOUND", status: 404 });
  const periodId = snap.reportingPeriodId;

  const [wasteRows, svRows, periodPlan, fuelRows, waterRows, assessment, fleetRows] = await Promise.all([
    prisma.wasteRecord.findMany({
      where: { organizationId: orgId, reportingPeriodId: periodId },
      select: { weightTonnes: true, disposalRoute: true },
    }),
    prisma.socialValueRecord.findMany({
      where: { organizationId: orgId, reportingPeriodId: periodId },
      select: { valuePounds: true, measure: { select: { theme: { select: { name: true } } } } },
    }),
    prisma.carbonReductionPlan.findFirst({ where: { organizationId: orgId, reportingPeriodId: periodId }, select: { sections: true } }),
    // Fuel the organisation burns itself: fleet and site fuel, counted once reviewed or approved.
    prisma.activityRecord.findMany({
      where: {
        organizationId: orgId,
        reportingPeriodId: periodId,
        reviewStatus: { in: ["in_review", "approved"] },
        emissionCategory: { code: { in: ["s1-mobile", "s1-stationary"] } },
      },
      select: { amount: true, unit: true, fuelType: true },
    }),
    prisma.waterRecord.findMany({
      where: { organizationId: orgId, reportingPeriodId: periodId },
      select: { metricType: true, volumeM3: true },
    }),
    // Only an assessment the organisation has approved is reported.
    prisma.materialityAssessment.findFirst({
      where: { organizationId: orgId, status: { in: ["approved", "published"] } },
      orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
      select: {
        name: true,
        status: true,
        approvedAt: true,
        methodologyNotes: true,
        stakeholderInput: true,
        topics: {
          select: { esrsCode: true, topicName: true, iroType: true, impactScore: true, financialScore: true, isMaterial: true, rationale: true },
        },
      },
    }),
    prisma.msFleetVehicle.findMany({
      where: { organizationId: orgId },
      select: { powertrain: true, status: true, inServiceFrom: true, inServiceTo: true },
    }),
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

  const revenue = rev.revenueAmount != null ? { amount: Number(rev.revenueAmount) } : null;
  const wasteIntensity = waste && inten ? perMillion(waste.totalTonnes, revenue) : null;
  // Only litres count: a record in kWh or tonnes cannot be added to a litre total.
  const fuel = fuelSummary(
    fuelRows
      .map((r) => ({ n: normalizeUnit(Number(r.amount), r.unit), fuelType: r.fuelType }))
      .filter((r) => r.n.unit === "litre")
      .map((r) => ({ litres: r.n.amount, fuelType: r.fuelType })),
  );
  const fleet = fleetSummary(fleetRows, snap.reportingPeriod.endDate);
  const waterTotals = waterSummary(waterRows.map((w) => ({ metric: w.metricType, m3: Number(w.volumeM3) })));
  const water = waterTotals ? { ...waterTotals, withdrawalPerMillion: perMillion(waterTotals.withdrawalM3, revenue) } : null;

  const themes = new Map<string, number>();
  for (const r of svRows) {
    const name = r.measure.theme.name;
    themes.set(name, (themes.get(name) ?? 0) + Number(r.valuePounds));
  }
  const socialValue = pack.socialValuePounds > 0
    ? { totalPounds: pack.socialValuePounds, byTheme: [...themes].map(([name, pounds]) => ({ name, pounds })).sort((a, b) => b.pounds - a.pounds) }
    : null;

  const top = pack.categories[0];
  const format = orgFormat(snap.organization);
  return {
    orgName: pack.orgName,
    pack,
    tiles: highlights({
      periodLabel: pack.snapshot.periodLabel,
      current: pack.current,
      baseYear: pack.baseYear,
      intensity: inten,
      waste,
      wasteIntensity,
      fuel,
      fleet,
      socialValuePounds: pack.socialValuePounds,
      topCategory: top ? { name: top.name, tonnes: top.tonnes } : null,
      fmt: formatters(format),
    }),
    years: yearTable(pack.baseYear, pack.history, pack.current, pack.snapshot.periodLabel),
    intensity: inten,
    scope3: scope3Disclosure(pack.categories, sections?.scope3 ?? []),
    waste,
    wasteIntensity,
    fuel,
    fleet,
    water,
    materiality: assessment
      ? {
          name: assessment.name,
          status: assessment.status,
          approvedAt: assessment.approvedAt,
          method: assessment.methodologyNotes,
          stakeholders: assessment.stakeholderInput,
          groups: materialByStandard(assessment.topics),
        }
      : null,
    socialValue,
    boundary: sections
      ? {
          approach: BOUNDARY_LABELS[sections.organisation.boundaryApproach] ?? sections.organisation.boundaryApproach,
          sites: sections.organisation.sitesIncluded,
          exclusions: sections.organisation.exclusions.map((e) => ({ item: e.item, reason: e.reason })),
        }
      : null,
    format,
  };
}
