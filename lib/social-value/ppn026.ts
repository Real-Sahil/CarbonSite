import type { Prisma } from "@prisma/client";

/**
 * PPN 026: The Social Value Model (Cabinet Office, published 5 August 2026).
 * Applies to central government procurements starting on or after
 * 1 January 2027 with a total value of £1m or more including VAT. Two
 * outcomes, six award criteria, weighted at least 10% (under £5m) or 20%
 * (£5m and above). It sets no reporting metrics: delivery is measured through
 * contract KPIs, at least three on contracts of £5m or more. Carbon is not
 * part of it; that stays with PPN 006.
 *
 * The sub-criteria and evaluation method are due in guidance in autumn 2026.
 * When they are published, add them as a new framework version rather than
 * editing this one, so KPIs set against the August 2026 text keep it.
 */
export const PPN026_SLUG = "ppn-026";
export const PPN026_VERSION = "August 2026";
export const PPN026_APPLIES_FROM = "2027-01-01";
export const PPN026_MIN_CONTRACT_VALUE = 1_000_000;
export const PPN026_KPI_THRESHOLD = 5_000_000;
export const PPN026_MIN_KPIS_LARGE = 3;

export type Ppn026Criterion = { code: string; name: string; description: string };
export type Ppn026Outcome = { code: string; name: string; description: string; criteria: Ppn026Criterion[] };

export const PPN026_OUTCOMES: Ppn026Outcome[] = [
  {
    code: "good-jobs",
    name: "Good Jobs",
    description: "Good employment opportunities in every postcode, with fair pay and good working conditions.",
    criteria: [
      { code: "jobs", name: "Create and retain high quality jobs", description: "New or retained jobs on the contract, including for people facing barriers to employment." },
      { code: "conditions", name: "Fair working conditions", description: "Working conditions beyond the statutory minimum that help people stay in work." },
      { code: "pay", name: "Fair pay", description: "Pay beyond the statutory minimum for people working on the contract." },
    ],
  },
  {
    code: "skills",
    name: "Skills",
    description: "Learning and development that addresses skills needs and shortages, such as apprenticeships and work placements.",
    criteria: [
      { code: "training", name: "Training and retraining", description: "Training, retraining, apprenticeships and work placements." },
      { code: "progression", name: "In-work progression", description: "Opportunities that help people move into higher-paid or more skilled work." },
      { code: "pipeline", name: "Talent pipeline", description: "Pre-employment training and routes into work that build the future workforce." },
    ],
  },
];

/** Minimum social value weighting a buyer must apply, or null below the threshold. */
export function ppn026MinimumWeighting(contractValue: number | null): number | null {
  if (contractValue == null || contractValue < PPN026_MIN_CONTRACT_VALUE) return null;
  return contractValue >= PPN026_KPI_THRESHOLD ? 20 : 10;
}

/** Creates the framework for the organisation, or returns the existing one. Idempotent. */
export async function installPpn026(tx: Prisma.TransactionClient, orgId: string): Promise<{ id: string; created: boolean }> {
  const existing = await tx.svFramework.findUnique({
    where: { organizationId_slug: { organizationId: orgId, slug: PPN026_SLUG } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const fw = await tx.svFramework.create({
    data: {
      organizationId: orgId,
      name: "PPN 026 Social Value Model",
      slug: PPN026_SLUG,
      version: PPN026_VERSION,
      description:
        "Central government Social Value Model for procurements from 1 January 2027 of £1m or more: Good Jobs and Skills, six award criteria. Delivery is tracked as contract KPIs.",
      themes: {
        create: PPN026_OUTCOMES.map((o, i) => ({
          code: o.code,
          name: o.name,
          description: o.description,
          sortOrder: i,
          outcomes: {
            create: o.criteria.map((c, j) => ({ code: c.code, name: c.name, description: c.description, sortOrder: j })),
          },
        })),
      },
    },
    select: { id: true },
  });
  return { id: fw.id, created: true };
}

// ── Contract KPIs: committed against delivered ───────────────────────────────

export type KpiInput = {
  id: string;
  title: string;
  outcomeCode: string | null;
  targetValue: number | null;
  targetUnit: string | null;
  status: string;
  activities: { status: string; quantityValue: number | null; quantityUnit: string | null; evidenceCount: number }[];
};

export type KpiSummary = {
  id: string;
  title: string;
  target: number | null;
  unit: string | null;
  delivered: number;
  progressPct: number | null;
  approvedEntries: number;
  pendingEntries: number;
  entriesWithEvidence: number;
};

const sameUnit = (a: string | null, b: string | null) => !a || !b || a.trim().toLowerCase() === b.trim().toLowerCase();

export function summariseKpi(k: KpiInput): KpiSummary {
  const approved = k.activities.filter((a) => a.status === "approved");
  const delivered = approved
    .filter((a) => a.quantityValue != null && sameUnit(a.quantityUnit, k.targetUnit))
    .reduce((s, a) => s + (a.quantityValue ?? 0), 0);
  return {
    id: k.id,
    title: k.title,
    target: k.targetValue,
    unit: k.targetUnit,
    delivered,
    progressPct: k.targetValue && k.targetValue > 0 ? Math.round((delivered / k.targetValue) * 100) : null,
    approvedEntries: approved.length,
    pendingEntries: k.activities.filter((a) => a.status === "submitted" || a.status === "under_review").length,
    entriesWithEvidence: approved.filter((a) => a.evidenceCount > 0).length,
  };
}

export type CriterionSummary = Ppn026Criterion & { outcomeCode: string; outcomeName: string; kpis: KpiSummary[] };

/** Every PPN 026 criterion in model order, with the contract's KPIs against it. Cancelled KPIs are left out. */
export function summarisePpn026(kpis: KpiInput[]): CriterionSummary[] {
  const live = kpis.filter((k) => k.status !== "cancelled");
  return PPN026_OUTCOMES.flatMap((o) =>
    o.criteria.map((c) => ({
      ...c,
      outcomeCode: o.code,
      outcomeName: o.name,
      kpis: live.filter((k) => k.outcomeCode === c.code).map(summariseKpi),
    })),
  );
}

export type Ppn026Check = { id: string; label: string; passed: boolean; fix: string };

export function ppn026Checks(contractValue: number | null, criteria: CriterionSummary[]): Ppn026Check[] {
  const kpis = criteria.flatMap((c) => c.kpis);
  const large = contractValue != null && contractValue >= PPN026_KPI_THRESHOLD;
  const needed = large ? PPN026_MIN_KPIS_LARGE : 1;
  const approvedWithoutEvidence = kpis.reduce((s, k) => s + (k.approvedEntries - k.entriesWithEvidence), 0);
  return [
    {
      id: "kpi-count",
      label: large
        ? `At least ${PPN026_MIN_KPIS_LARGE} social value KPIs (contracts of £5m or more)`
        : "At least one social value KPI",
      passed: kpis.length >= needed,
      fix: `Add ${Math.max(needed - kpis.length, 0)} more KPI${needed - kpis.length === 1 ? "" : "s"} against the criteria you committed to in the bid.`,
    },
    {
      id: "targets",
      label: "Every KPI has a target and a unit",
      passed: kpis.length > 0 && kpis.every((k) => k.target != null && k.target > 0 && !!k.unit),
      fix: "Give each KPI the number and unit committed in the bid, for example 12 apprenticeship starts.",
    },
    {
      id: "evidence",
      label: "Every approved delivery entry has evidence attached",
      passed: approvedWithoutEvidence === 0,
      fix: `${approvedWithoutEvidence} approved entr${approvedWithoutEvidence === 1 ? "y has" : "ies have"} no evidence. Attach payroll extracts, training records or timesheets.`,
    },
  ];
}
