// Bid carbon pack: the carbon evidence a UK public tender asks for, in one
// document. Every figure is read from published snapshots (DashboardAggregate
// and the snapshot's immutable calculations) or from records the org keeps in
// the app, so a bid team can defend each number. Nothing here is estimated or
// generated: a section with no data is left out and flagged by the readiness
// checks instead.

import { z } from "zod";
import { prisma } from "@/lib/db";
import { countsTowardHeadline, scope2MethodOf } from "@/lib/calculation/scope2-method";
import { CATEGORY_BREAKDOWN_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import { wasteHierarchyOf } from "@/lib/waste/hierarchy";

export const MAX_FEATURED_CONTRACTS = 5;

export const bidPackOptionsSchema = z.object({
  bidTitle: z.string().trim().max(200).optional(),
  buyerName: z.string().trim().max(200).optional(),
  tenderReference: z.string().trim().max(100).optional(),
  contractIds: z.array(z.string().min(1)).max(MAX_FEATURED_CONTRACTS).optional(),
  signatoryName: z.string().trim().max(120).optional(),
  signatoryTitle: z.string().trim().max(120).optional(),
  signatoryDate: z.string().trim().max(40).optional(),
  netZeroYear: z.coerce.number().int().min(2025).max(2100).optional(),
});
export type BidPackOptions = z.infer<typeof bidPackOptionsSchema>;

/** Tonnes CO2e. `s2Market` is reported beside the headline, never added to it. */
export type ScopeTotals = { s1: number; s2: number; s2Market: number | null; s3: number; total: number };

/** The five Scope 3 categories a PPN 06/21 / PPN 006 Carbon Reduction Plan must report. */
export const PPN_SCOPE3_CATEGORIES = [
  { code: "s3-upstream-transport", label: "Upstream transportation and distribution (category 4)" },
  { code: "s3-waste", label: "Waste generated in operations (category 5)" },
  { code: "s3-business-travel", label: "Business travel (category 6)" },
  { code: "s3-commuting", label: "Employee commuting (category 7)" },
  { code: "s3-downstream-transport", label: "Downstream transportation and distribution (category 9)" },
] as const;

export type BidPackData = {
  orgName: string;
  bid: { title: string | null; buyer: string | null; reference: string | null };
  snapshot: {
    id: string;
    version: number;
    publishedAt: Date;
    publishedBy: string;
    periodLabel: string;
    periodStart: Date;
    periodEnd: Date;
    factorLibrary: string;
    methodology: string;
    gwpVersion: string;
    recordCount: number;
    reviewStatus: "pending_review" | "approved" | "changes_requested";
  };
  current: ScopeTotals;
  categories: { code: string; name: string; scope: number; tonnes: number }[];
  ppnScope3: { code: string; label: string; tonnes: number | null }[];
  history: { periodLabel: string; periodEnd: Date; snapshotVersion: number; totals: ScopeTotals }[];
  baseYear: { label: string; s1: number | null; s2: number | null; s3: number | null; total: number | null } | null;
  targets: { type: "absolute" | "intensity"; baselineLabel: string; targetLabel: string; reductionTonnes: number; baselineTonnes: number | null }[];
  netZeroYear: number;
  initiatives: { name: string; status: string; expectedTonnes: number | null }[];
  assurance: {
    auditorSignOff: { status: string; signedAt: Date | null } | null;
    engagement: { provider: string; standard: string; level: string; status: string; opinionIssuedAt: Date | null } | null;
  };
  contracts: {
    id: string;
    name: string;
    client: string | null;
    reference: string | null;
    value: number | null;
    currency: string;
    startDate: Date | null;
    endDate: Date | null;
    tonnes: number;
    tonnesPerMillion: number | null;
    budgetTonnes: number | null;
    socialValuePounds: number;
    /// National TOMs on this contract, for periods ending on or before the
    /// snapshot's period end: the committed target beside what was delivered.
    socialValue: ContractSocialValue;
    wasteTonnes: number;
    diversionRate: number | null;
  }[];
  socialValuePounds: number;
  signatory: { name: string | null; title: string | null; date: string | null };
};

export type ContractSocialValue = {
  targetPounds: number | null;
  themes: { code: string; name: string; pounds: number }[];
  measures: { code: string; name: string; quantity: number; unit: string; pounds: number }[];
};

const DIVERTED = new Set(["recycle", "recovery"]);
const t = (kg: number) => kg / 1000;
const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

type AggRow = { snapshotId: string | null; scope: number; scope2Method: string | null; totalCo2e: { toString(): string } };

/** Scope totals from a snapshot's scope rollup rows (kg in, tonnes out). */
export function scopeTotalsFromRollup(rows: AggRow[]): ScopeTotals {
  let s1 = 0, s2 = 0, s3 = 0, mb = 0, hasMb = false;
  for (const r of rows) {
    const kg = Number(r.totalCo2e);
    if (r.scope === 2 && r.scope2Method === "market_based") { mb += kg; hasMb = true; continue; }
    if (r.scope === 1) s1 += kg;
    else if (r.scope === 2) s2 += kg;
    else if (r.scope === 3) s3 += kg;
  }
  return { s1: t(s1), s2: t(s2), s2Market: hasMb ? t(mb) : null, s3: t(s3), total: t(s1 + s2 + s3) };
}

export async function loadBidPackData(orgId: string, snapshotId: string, rawOptions: unknown): Promise<BidPackData> {
  const opts = bidPackOptionsSchema.parse(rawOptions ?? {});

  const snapshot = await prisma.publishedSnapshot.findFirst({
    where: { id: snapshotId, organizationId: orgId },
    include: {
      organization: { select: { name: true } },
      reportingPeriod: { select: { id: true, label: true, startDate: true, endDate: true } },
      publishedBy: { select: { name: true, email: true } },
      calculationRun: {
        select: {
          id: true,
          factorLibrary: { select: { name: true, version: true } },
          methodologyVersion: { select: { name: true, gwpVersion: true } },
        },
      },
      assurance: { select: { status: true, signedAt: true } },
    },
  });
  if (!snapshot) throw Object.assign(new Error("Snapshot not found."), { code: "NOT_FOUND", status: 404 });

  const periodEnd = snapshot.reportingPeriod.endDate;
  const contractIds = [...new Set(opts.contractIds ?? [])];

  const [rollup, categoryRows, recordCount, allSnapshots, baseYear, targets, initiatives, engagement, contracts, svPeriod] =
    await Promise.all([
      prisma.dashboardAggregate.findMany({
        where: { organizationId: orgId, snapshotId, emissionCategoryId: null, facilityId: null, businessUnitId: null },
        select: { snapshotId: true, scope: true, scope2Method: true, totalCo2e: true },
      }),
      prisma.dashboardAggregate.findMany({
        where: { organizationId: orgId, snapshotId, ...CATEGORY_BREAKDOWN_DIMENSIONS },
        select: { scope: true, totalCo2e: true, emissionCategory: { select: { code: true, name: true } } },
      }),
      prisma.emissionCalculation.count({ where: { organizationId: orgId, calculationRunId: snapshot.calculationRun.id } }),
      prisma.publishedSnapshot.findMany({
        where: { organizationId: orgId, reportingPeriod: { endDate: { lte: periodEnd } } },
        select: {
          id: true,
          version: true,
          reportingPeriodId: true,
          reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
        },
        orderBy: [{ reportingPeriodId: "asc" }, { version: "desc" }],
      }),
      prisma.baseYear.findFirst({
        where: { organizationId: orgId, status: "active" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.reductionTarget.findMany({
        where: { organizationId: orgId },
        include: {
          baselinePeriod: { select: { id: true, label: true } },
          targetPeriod: { select: { label: true, endDate: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.reductionInitiative.findMany({
        where: { organizationId: orgId, status: { not: "canceled" } },
        select: { name: true, status: true, expectedImpactCo2e: true },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      }),
      prisma.assuranceEngagement.findFirst({
        where: { organizationId: orgId, snapshotId, status: { not: "withdrawn" } },
        orderBy: { createdAt: "desc" },
        select: { providerName: true, standard: true, level: true, status: true, opinionIssuedAt: true },
      }),
      contractIds.length
        ? prisma.contract.findMany({ where: { organizationId: orgId, id: { in: contractIds } } })
        : Promise.resolve([]),
      prisma.socialValueRecord.aggregate({
        where: { organizationId: orgId, reportingPeriodId: snapshot.reportingPeriodId },
        _sum: { valuePounds: true },
      }),
    ]);

  // Latest published version per period, oldest period first, last six.
  const latestPerPeriod = new Map<string, (typeof allSnapshots)[number]>();
  for (const s of allSnapshots) if (!latestPerPeriod.has(s.reportingPeriodId)) latestPerPeriod.set(s.reportingPeriodId, s);
  latestPerPeriod.set(snapshot.reportingPeriodId, {
    id: snapshot.id,
    version: snapshot.version,
    reportingPeriodId: snapshot.reportingPeriodId,
    reportingPeriod: snapshot.reportingPeriod,
  });
  const historySnapshots = [...latestPerPeriod.values()]
    .sort((a, b) => a.reportingPeriod.startDate.getTime() - b.reportingPeriod.startDate.getTime())
    .slice(-6);
  const historyRows = await prisma.dashboardAggregate.findMany({
    where: {
      organizationId: orgId,
      snapshotId: { in: historySnapshots.map((s) => s.id) },
      emissionCategoryId: null,
      facilityId: null,
      businessUnitId: null,
    },
    select: { snapshotId: true, scope: true, scope2Method: true, totalCo2e: true },
  });
  const history = historySnapshots.map((s) => ({
    periodLabel: s.reportingPeriod.label,
    periodEnd: s.reportingPeriod.endDate,
    snapshotVersion: s.version,
    totals: scopeTotalsFromRollup(historyRows.filter((r) => r.snapshotId === s.id)),
  }));

  const categories = categoryRows
    .filter((r) => r.emissionCategory)
    .map((r) => ({ code: r.emissionCategory!.code, name: r.emissionCategory!.name, scope: r.scope, tonnes: t(Number(r.totalCo2e)) }))
    .sort((a, b) => b.tonnes - a.tonnes);
  const byCode = new Map(categories.map((c) => [c.code, c.tonnes]));

  // Baseline tonnes for each target, from its baseline period's latest snapshot.
  const baselineTotals = new Map(history.map((h, i) => [historySnapshots[i].reportingPeriodId, h.totals.total]));

  return {
    orgName: snapshot.organization.name,
    bid: { title: opts.bidTitle || null, buyer: opts.buyerName || null, reference: opts.tenderReference || null },
    snapshot: {
      id: snapshot.id,
      version: snapshot.version,
      publishedAt: snapshot.publishedAt,
      publishedBy: snapshot.publishedBy.name ?? snapshot.publishedBy.email,
      periodLabel: snapshot.reportingPeriod.label,
      periodStart: snapshot.reportingPeriod.startDate,
      periodEnd,
      factorLibrary: `${snapshot.calculationRun.factorLibrary?.name ?? ""} ${snapshot.calculationRun.factorLibrary?.version ?? ""}`.trim() || "Not recorded",
      methodology: snapshot.calculationRun.methodologyVersion?.name ?? "Not recorded",
      gwpVersion: snapshot.calculationRun.methodologyVersion?.gwpVersion ?? "Not recorded",
      recordCount,
      reviewStatus: snapshot.verificationStatus,
    },
    current: scopeTotalsFromRollup(rollup),
    categories,
    ppnScope3: PPN_SCOPE3_CATEGORIES.map((c) => ({ code: c.code, label: c.label, tonnes: byCode.get(c.code) ?? null })),
    history,
    baseYear: baseYear
      ? {
          label: baseYear.label,
          s1: num(baseYear.currentScope1Co2e ?? baseYear.originalScope1Co2e),
          s2: num(baseYear.currentScope2Co2e ?? baseYear.originalScope2Co2e),
          s3: num(baseYear.currentScope3Co2e ?? baseYear.originalScope3Co2e),
          total: num(baseYear.currentTotalCo2e ?? baseYear.originalTotalCo2e),
        }
      : null,
    targets: targets.map((tg) => ({
      type: tg.targetType,
      baselineLabel: tg.baselinePeriod.label,
      targetLabel: tg.targetPeriod.label,
      reductionTonnes: t(Number(tg.reductionAmount)),
      baselineTonnes: baselineTotals.get(tg.baselinePeriod.id) ?? null,
    })),
    netZeroYear: opts.netZeroYear ?? 2050,
    initiatives: initiatives.map((i) => ({
      name: i.name,
      status: i.status,
      expectedTonnes: i.expectedImpactCo2e != null ? t(Number(i.expectedImpactCo2e)) : null,
    })),
    assurance: {
      auditorSignOff: snapshot.assurance ? { status: snapshot.assurance.status, signedAt: snapshot.assurance.signedAt } : null,
      engagement: engagement
        ? {
            provider: engagement.providerName,
            standard: engagement.standard,
            level: engagement.level,
            status: engagement.status,
            opinionIssuedAt: engagement.opinionIssuedAt,
          }
        : null,
    },
    contracts: await loadContractEvidence(orgId, snapshot.calculationRun.id, contracts, contractIds, periodEnd),
    socialValuePounds: Number(svPeriod._sum.valuePounds ?? 0),
    signatory: { name: opts.signatoryName || null, title: opts.signatoryTitle || null, date: opts.signatoryDate || null },
  };
}

async function loadContractEvidence(
  orgId: string,
  calculationRunId: string,
  contracts: Awaited<ReturnType<typeof prisma.contract.findMany>>,
  requestedOrder: string[],
  periodEnd: Date,
): Promise<BidPackData["contracts"]> {
  if (contracts.length === 0) return [];
  const ids = contracts.map((c) => c.id);
  const toDate = { reportingPeriod: { endDate: { lte: periodEnd } } };

  const [calcs, budgets, social, waste, svTargets] = await Promise.all([
    prisma.emissionCalculation.findMany({
      where: { organizationId: orgId, calculationRunId, activityRecord: { contractId: { in: ids } } },
      select: {
        totalCo2e: true,
        activityRecord: { select: { contractId: true, scope2Method: true, emissionCategory: { select: { scope: true, code: true } } } },
      },
    }),
    prisma.carbonBudget.findMany({
      where: { organizationId: orgId, project: { contractId: { in: ids } } },
      select: { totalBudgetTco2e: true, project: { select: { contractId: true } } },
    }),
    prisma.socialValueRecord.findMany({
      where: { organizationId: orgId, contractId: { in: ids }, ...toDate },
      select: {
        contractId: true,
        quantity: true,
        valuePounds: true,
        measure: { select: { tomsCode: true, name: true, unit: true, theme: { select: { code: true, name: true, sortOrder: true } } } },
      },
    }),
    prisma.wasteRecord.findMany({
      where: { organizationId: orgId, project: { contractId: { in: ids } } },
      select: { weightTonnes: true, disposalRoute: true, project: { select: { contractId: true } } },
    }),
    prisma.socialValueTarget.findMany({
      where: { organizationId: orgId, contractId: { in: ids }, ...toDate },
      select: { contractId: true, targetPounds: true },
    }),
  ]);

  const kg = new Map<string, number>();
  for (const c of calcs) {
    if (!countsTowardHeadline(scope2MethodOf(c.activityRecord))) continue;
    const id = c.activityRecord.contractId!;
    kg.set(id, (kg.get(id) ?? 0) + Number(c.totalCo2e));
  }
  const budget = new Map<string, number>();
  for (const b of budgets) budget.set(b.project.contractId, (budget.get(b.project.contractId) ?? 0) + Number(b.totalBudgetTco2e));
  const wasteBy = new Map<string, { tonnes: number; diverted: number }>();
  for (const w of waste) {
    const id = w.project!.contractId;
    const s = wasteBy.get(id) ?? { tonnes: 0, diverted: 0 };
    const tonnes = Number(w.weightTonnes);
    s.tonnes += tonnes;
    if (DIVERTED.has(wasteHierarchyOf(w.disposalRoute))) s.diverted += tonnes;
    wasteBy.set(id, s);
  }

  return contracts
    .map((c) => {
      const tonnes = t(kg.get(c.id) ?? 0);
      const value = c.contractValue != null ? Number(c.contractValue) : null;
      const w = wasteBy.get(c.id);
      return {
        id: c.id,
        name: c.name,
        client: c.clientName,
        reference: c.contractReference,
        value,
        currency: c.currency,
        startDate: c.startDate,
        endDate: c.endDate,
        tonnes,
        tonnesPerMillion: value && value > 0 ? tonnes / (value / 1_000_000) : null,
        budgetTonnes: budget.get(c.id) ?? null,
        socialValuePounds: social.filter((r) => r.contractId === c.id).reduce((sum, r) => sum + Number(r.valuePounds), 0),
        socialValue: summariseSocialValue(
          social.filter((r) => r.contractId === c.id),
          svTargets.filter((tg) => tg.contractId === c.id),
        ),
        wasteTonnes: w?.tonnes ?? 0,
        diversionRate: w && w.tonnes > 0 ? w.diverted / w.tonnes : null,
      };
    })
    .sort((a, b) => requestedOrder.indexOf(a.id) - requestedOrder.indexOf(b.id));
}

// ── Pure helpers (unit tested) ────────────────────────────────────────────────

type SvRecord = {
  quantity: { toString(): string };
  valuePounds: { toString(): string };
  measure: { tomsCode: string; name: string; unit: string; theme: { code: string; name: string; sortOrder: number } };
};

/** TOMs delivered by theme (framework order) and the five largest measures, beside the committed target. */
export function summariseSocialValue(records: SvRecord[], targets: { targetPounds: { toString(): string } }[]): ContractSocialValue {
  const themes = new Map<string, { code: string; name: string; order: number; pounds: number }>();
  const measures = new Map<string, { code: string; name: string; quantity: number; unit: string; pounds: number }>();
  for (const r of records) {
    const pounds = Number(r.valuePounds);
    const th = themes.get(r.measure.theme.code) ?? { code: r.measure.theme.code, name: r.measure.theme.name, order: r.measure.theme.sortOrder, pounds: 0 };
    th.pounds += pounds;
    themes.set(th.code, th);
    const m = measures.get(r.measure.tomsCode) ?? { code: r.measure.tomsCode, name: r.measure.name, quantity: 0, unit: r.measure.unit, pounds: 0 };
    m.quantity += Number(r.quantity);
    m.pounds += pounds;
    measures.set(m.code, m);
  }
  return {
    targetPounds: targets.length ? targets.reduce((sum, tg) => sum + Number(tg.targetPounds), 0) : null,
    themes: [...themes.values()].sort((a, b) => a.order - b.order).map(({ code, name, pounds }) => ({ code, name, pounds })),
    measures: [...measures.values()].sort((a, b) => b.pounds - a.pounds).slice(0, 5),
  };
}

const fmtGbp = (v: number) => `£${Math.round(v).toLocaleString("en-GB")}`;

/**
 * One answer per featured contract that puts its carbon, waste and social
 * value side by side, for a tender question about comparable work. Built only
 * from the pack's figures; a clause with no figure is left out.
 */
export function contractAnswer(c: BidPackData["contracts"][number], periodLabel: string): string {
  const parts: string[] = [];
  const intro = `On ${c.name}${c.client ? ` for ${c.client}` : ""} we recorded ${fmtT(c.tonnes)} tCO2e in ${periodLabel}`;
  const carbon: string[] = [];
  if (c.tonnesPerMillion != null) carbon.push(`${fmtT(c.tonnesPerMillion)} tCO2e per £1m of contract value`);
  if (c.budgetTonnes != null) carbon.push(`against a carbon budget of ${fmtT(c.budgetTonnes)} tCO2e`);
  parts.push(`${intro}${carbon.length ? `, ${carbon.join(", ")}` : ""}.`);
  if (c.wasteTonnes > 0 && c.diversionRate != null) {
    parts.push(`${(c.diversionRate * 100).toFixed(0)}% of ${fmtT(c.wasteTonnes)} t of waste was diverted from landfill.`);
  }
  const sv = c.socialValue;
  if (c.socialValuePounds > 0) {
    const vs = sv.targetPounds != null && sv.targetPounds > 0 ? ` against a commitment of ${fmtGbp(sv.targetPounds)} (${Math.round((c.socialValuePounds / sv.targetPounds) * 100)}%)` : "";
    const top = sv.measures.slice(0, 3).map((m) => `${m.name} (${m.code})`);
    parts.push(
      `We have delivered ${fmtGbp(c.socialValuePounds)} of social value measured with the National TOMs${vs}${top.length ? `, led by ${listNames(top)}` : ""}.`,
    );
  } else if (sv.targetPounds != null && sv.targetPounds > 0) {
    parts.push(`We have committed ${fmtGbp(sv.targetPounds)} of social value under the National TOMs; delivery is recorded as it happens.`);
  }
  if (c.socialValuePounds > 0 || (sv.targetPounds ?? 0) > 0) {
    parts.push("Carbon and social value are recorded against the same contract, so both figures come from one set of records.");
  }
  return parts.join(" ");
}

const fmtT = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: v < 10 ? 2 : 1 });
const pct = (v: number) => `${Math.abs(v * 100).toFixed(1)}%`;

/** Change from `from` to `to` as a fraction; null when there is no usable baseline. */
export function change(from: number | null | undefined, to: number): number | null {
  return from != null && from > 0 ? (to - from) / from : null;
}

export type ReadinessCheck = { id: string; description: string; required: boolean; passed: boolean; message?: string };

/**
 * What a buyer's evaluator will look for, checked before the pack is
 * generated. Required checks block generation: a Carbon Reduction Plan without
 * a baseline, sign-off or net zero commitment fails the PPN test outright.
 */
export function bidPackReadiness(d: BidPackData): ReadinessCheck[] {
  const missingS3 = d.ppnScope3.filter((c) => c.tonnes == null);
  const checks: ReadinessCheck[] = [
    {
      id: "bid-emissions",
      description: "The snapshot has Scope 1 and 2 emissions",
      required: true,
      passed: d.current.s1 + d.current.s2 > 0,
      message: "Publish a snapshot with Scope 1 and 2 records first.",
    },
    {
      id: "bid-base-year",
      description: "An active base year is set",
      required: true,
      passed: d.baseYear?.total != null,
      message: "A Carbon Reduction Plan must state baseline emissions. Set a base year under Targets.",
    },
    {
      id: "bid-net-zero",
      description: "Net zero commitment by 2050 or earlier",
      required: true,
      passed: d.netZeroYear <= 2050,
      message: "PPN 006 requires a commitment to net zero by 2050 at the latest.",
    },
    {
      id: "bid-signatory",
      description: "Board-level sign-off named",
      required: true,
      passed: !!d.signatory.name && !!d.signatory.title,
      message: "The plan must be signed off by a director. Add the signatory's name and title.",
    },
    {
      id: "bid-scope3",
      description: "The five PPN Scope 3 categories are reported",
      required: false,
      passed: missingS3.length === 0,
      message: `No data for: ${missingS3.map((c) => c.label).join("; ")}. Report them or explain why they are not relevant.`,
    },
    {
      id: "bid-reviewed",
      description: "The snapshot has been reviewed and approved",
      required: false,
      passed: d.snapshot.reviewStatus === "approved",
      message: "Evaluators give more weight to reviewed figures. Approve the snapshot under Calculations.",
    },
    {
      id: "bid-assurance",
      description: "Independent assurance or auditor sign-off",
      required: false,
      passed: d.assurance.engagement?.status === "signed" || d.assurance.auditorSignOff?.status === "approved",
      message: "No signed assurance opinion or auditor sign-off on this snapshot.",
    },
    {
      id: "bid-measures",
      description: "Carbon reduction measures are listed",
      required: false,
      passed: d.initiatives.length > 0,
      message: "Add completed and planned reduction initiatives under Targets.",
    },
    {
      id: "bid-contracts",
      description: "Comparable contracts are featured",
      required: false,
      passed: d.contracts.length > 0,
      message: "Pick up to five similar contracts to show delivery evidence.",
    },
  ];
  return checks.map((c) => (c.passed ? { ...c, message: undefined } : c));
}

/**
 * Model answers to the carbon questions tenders usually ask, built only from
 * the pack's own figures. A sentence whose figure is missing is left out.
 */
export function bidAnswers(d: BidPackData): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = [];
  const s12 = d.current.s1 + d.current.s2;
  const period = d.snapshot.periodLabel;

  const footprint = [
    `For ${period} our measured emissions were ${fmtT(d.current.total)} tCO2e: ${fmtT(d.current.s1)} tCO2e Scope 1, ${fmtT(d.current.s2)} tCO2e Scope 2 (location-based) and ${fmtT(d.current.s3)} tCO2e Scope 3.`,
  ];
  if (d.current.s2Market != null) footprint.push(`Market-based Scope 2 was ${fmtT(d.current.s2Market)} tCO2e.`);
  footprint.push(
    `Figures follow the GHG Protocol Corporate Standard, using ${d.snapshot.factorLibrary} emission factors and ${d.snapshot.gwpVersion} global warming potentials, and come from ${d.snapshot.recordCount.toLocaleString("en-GB")} calculated activity records in published snapshot v${d.snapshot.version}.`,
  );
  out.push({ question: "What is your organisation's carbon footprint?", answer: footprint.join(" ") });

  const progress: string[] = [];
  if (d.baseYear?.total != null) {
    const baseS12 = d.baseYear.s1 != null && d.baseYear.s2 != null ? d.baseYear.s1 + d.baseYear.s2 : null;
    const c12 = change(baseS12, s12);
    const cAll = change(d.baseYear.total, d.current.total);
    if (c12 != null) {
      progress.push(`Scope 1 and 2 emissions are ${pct(c12)} ${c12 <= 0 ? "lower" : "higher"} than our ${d.baseYear.label} base year.`);
    } else if (cAll != null) {
      progress.push(`Total emissions are ${pct(cAll)} ${cAll <= 0 ? "lower" : "higher"} than our ${d.baseYear.label} base year.`);
    }
  }
  if (d.history.length >= 2) {
    const prev = d.history[d.history.length - 2];
    const c = change(prev.totals.s1 + prev.totals.s2, s12);
    if (c != null) progress.push(`Since ${prev.periodLabel}, Scope 1 and 2 emissions have ${c <= 0 ? "fallen" : "risen"} by ${pct(c)}.`);
  }
  const done = d.initiatives.filter((i) => i.status === "complete");
  if (done.length) progress.push(`Completed reduction measures include ${listNames(done.map((i) => i.name))}.`);
  if (progress.length) out.push({ question: "How have your emissions changed, and what have you done to reduce them?", answer: progress.join(" ") });

  const plan: string[] = [`We are committed to reaching net zero by ${d.netZeroYear}.`];
  const absolute = d.targets.filter((tg) => tg.type === "absolute");
  for (const tg of absolute.slice(0, 3)) {
    const share = tg.baselineTonnes ? ` (${pct(tg.reductionTonnes / tg.baselineTonnes)} of the baseline)` : "";
    plan.push(`We will cut emissions by ${fmtT(tg.reductionTonnes)} tCO2e${share} between ${tg.baselineLabel} and ${tg.targetLabel}.`);
  }
  const next = d.initiatives.filter((i) => i.status !== "complete");
  if (next.length) plan.push(`Measures under way or planned: ${listNames(next.map((i) => i.name))}.`);
  out.push({ question: "What are your carbon reduction targets and plans?", answer: plan.join(" ") });

  if (d.contracts.length) {
    const lines = d.contracts.slice(0, 3).map((c) => {
      const parts = [`${c.name}${c.client ? ` for ${c.client}` : ""}: ${fmtT(c.tonnes)} tCO2e in ${period}`];
      if (c.tonnesPerMillion != null) parts.push(`${fmtT(c.tonnesPerMillion)} tCO2e per £1m of contract value`);
      if (c.diversionRate != null) parts.push(`${(c.diversionRate * 100).toFixed(0)}% of ${fmtT(c.wasteTonnes)} t waste diverted from landfill`);
      return parts.join(", ");
    });
    out.push({
      question: "How do you measure and manage carbon on contracts like this one?",
      answer: `Every contract's activity data is recorded against it and calculated with the same method as our corporate inventory. Examples: ${lines.join("; ")}.`,
    });
  }

  const withSv = d.contracts.filter((c) => c.socialValuePounds > 0);
  if (withSv.length) {
    const delivered = withSv.reduce((sum, c) => sum + c.socialValuePounds, 0);
    const lines = withSv.slice(0, 3).map((c) => {
      const tg = c.socialValue.targetPounds;
      return `${c.name}: ${fmtGbp(c.socialValuePounds)}${tg ? ` of ${fmtGbp(tg)} committed` : ""}`;
    });
    out.push({
      question: "What social value have you delivered on comparable contracts?",
      answer: `We measure social value with the National TOMs and record it against each contract as it is delivered. On the contracts featured here we have delivered ${fmtGbp(delivered)} to date: ${lines.join("; ")}.`,
    });
  }

  if (d.assurance.engagement?.status === "signed") {
    const e = d.assurance.engagement;
    out.push({
      question: "Are your emissions figures verified?",
      answer: `Yes. ${e.provider} provided ${e.level} assurance under ${STANDARD_LABELS[e.standard] ?? e.standard} on snapshot v${d.snapshot.version}.`,
    });
  }
  return out;
}

export const STANDARD_LABELS: Record<string, string> = {
  isae_3000: "ISAE 3000",
  iso_14064_3: "ISO 14064-3",
  aa1000as: "AA1000AS",
  other: "another recognised standard",
};

function listNames(names: string[]): string {
  const shown = names.slice(0, 4);
  const rest = names.length - shown.length;
  const joined = shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}` : shown[0];
  return rest > 0 ? `${joined} (and ${rest} more)` : joined;
}
