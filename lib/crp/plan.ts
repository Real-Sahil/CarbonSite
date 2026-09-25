// PPN 006 Carbon Reduction Plan, prepared through the guided flow.
//
// The Cabinet Office template asks for: the supplier and its publication, a
// commitment to net zero by 2050 at the latest, baseline emissions with the
// reason the baseline year was chosen, current emissions (Scope 1, Scope 2
// and Scope 3 categories 4, 5, 6, 7 and 9), reduction targets, completed and
// planned carbon reduction projects, and a declaration signed by a director.
// This module holds the plan's own text and choices (validated here) and the
// readiness checks run before the report is generated. Emissions figures are
// never stored on the plan: they come from the period's published snapshot and
// the active base year at generation time.

import { z } from "zod";
import { PPN_SCOPE3_CATEGORIES } from "@/lib/bids/carbon-pack";

export const BOUNDARY_APPROACHES = [
  { value: "operational_control", label: "Operational control" },
  { value: "financial_control", label: "Financial control" },
  { value: "equity_share", label: "Equity share" },
] as const;

export const SCOPE3_STATUSES = [
  { value: "reported", label: "Reported from records" },
  { value: "not_relevant", label: "Not relevant to our operations" },
  { value: "not_yet_measured", label: "Relevant, not yet measured" },
] as const;

const text = (max: number) => z.string().trim().max(max).default("");
const year = z.coerce.number().int().min(2000).max(2100);

const measureSchema = z.object({
  id: z.string().min(1).max(40),
  name: text(200),
  year: z.union([year, z.literal("")]).default(""),
  description: text(1000),
  /** Estimated annual saving in tCO2e, as the supplier states it. Optional. */
  savingTco2e: z.union([z.coerce.number().min(0).max(1e9), z.literal("")]).default(""),
});
export type CrpMeasure = z.infer<typeof measureSchema>;

export const crpSectionsSchema = z.object({
  organisation: z
    .object({
      companyNumber: text(20),
      publicationUrl: text(500),
      description: text(2000),
      boundaryApproach: z.enum(["operational_control", "financial_control", "equity_share"]).default("operational_control"),
      sitesIncluded: text(2000),
      exclusions: z.array(z.object({ id: z.string().min(1).max(40), item: text(200), reason: text(500) })).max(20).default([]),
      /** Opt-in footer line linking the published plan to its verification page. */
      showVerificationLine: z.boolean().default(false),
    })
    .default({}),
  baseline: z
    .object({
      rationale: text(2000),
      additionalDetails: text(2000),
    })
    .default({}),
  scope3: z
    .array(
      z.object({
        code: z.enum(PPN_SCOPE3_CATEGORIES.map((c) => c.code) as [string, ...string[]]),
        status: z.enum(["reported", "not_relevant", "not_yet_measured"]).default("reported"),
        explanation: text(1000),
      }),
    )
    .max(PPN_SCOPE3_CATEGORIES.length)
    .default([]),
  targets: z
    .object({
      netZeroYear: z.union([year, z.literal("")]).default(""),
      interim: z
        .array(
          z.object({
            id: z.string().min(1).max(40),
            year: z.union([year, z.literal("")]).default(""),
            reductionPct: z.union([z.coerce.number().gt(0).max(100), z.literal("")]).default(""),
            scopes: z.enum(["s1s2", "s1s2s3"]).default("s1s2"),
          }),
        )
        .max(10)
        .default([]),
      sbtiValidated: z.boolean().default(false),
      trajectoryNote: text(2000),
    })
    .default({}),
  measures: z
    .object({
      completed: z.array(measureSchema).max(30).default([]),
      planned: z.array(measureSchema).max(30).default([]),
      futureNote: text(2000),
    })
    .default({}),
  secr: z
    .object({
      include: z.boolean().default(false),
      intensityDenominator: text(80),
      intensityValue: z.union([z.coerce.number().gt(0).max(1e12), z.literal("")]).default(""),
      efficiencyNarrative: text(3000),
    })
    .default({}),
  declaration: z
    .object({
      signatoryName: text(120),
      signatoryTitle: text(120),
      signedDate: text(10),
      boardApproved: z.boolean().default(false),
      methodologyConfirmed: z.boolean().default(false),
    })
    .default({}),
});
export type CrpSections = z.infer<typeof crpSectionsSchema>;

/** Stored JSON back into a full sections object; anything malformed falls back to its default. */
export function parseSections(raw: unknown): CrpSections {
  const parsed = crpSectionsSchema.safeParse(raw ?? {});
  if (parsed.success) return withScope3Rows(parsed.data);
  return withScope3Rows(crpSectionsSchema.parse({}));
}

/** One row per PPN Scope 3 category, in PPN order, keeping any saved answers. */
function withScope3Rows(s: CrpSections): CrpSections {
  const byCode = new Map(s.scope3.map((r) => [r.code, r]));
  return {
    ...s,
    scope3: PPN_SCOPE3_CATEGORIES.map((c) => byCode.get(c.code) ?? { code: c.code, status: "reported" as const, explanation: "" }),
  };
}

// ── Context read from the organisation's records ─────────────────────────────

export type CrpContext = {
  period: { id: string; label: string; startDate: Date; endDate: Date };
  records: { total: number; approved: number; byScope: Record<1 | 2 | 3, number> };
  latestRun: { id: string; status: string; finishedAt: Date | null } | null;
  snapshot: {
    id: string;
    version: number;
    publishedAt: Date;
    calculationRunId: string;
    reviewStatus: string;
    totals: { s1: number; s2: number; s2Market: number | null; s3: number; total: number };
  } | null;
  /** Newer succeeded run than the published snapshot: the plan would report stale figures. */
  unpublishedRun: boolean;
  ppnScope3: { code: string; label: string; tonnes: number | null }[];
  baseYear: {
    id: string;
    label: string;
    status: string;
    periodLabel: string;
    endYear: number;
    s1: number | null;
    s2: number | null;
    s3: number | null;
    total: number | null;
  } | null;
  initiatives: { name: string; status: string; expectedTonnes: number | null }[];
  runDefaults: { factorLibraryId: string; methodologyVersionId: string } | null;
};

// ── Readiness (pure, unit tested) ─────────────────────────────────────────────

export type CrpSectionKey =
  | "period"
  | "organisation"
  | "emissions"
  | "baseline"
  | "targets"
  | "measures"
  | "secr"
  | "declaration";

export type CrpCheck = {
  id: string;
  section: CrpSectionKey;
  label: string;
  required: boolean;
  passed: boolean;
  fix?: string;
};

const filled = (v: string | number | "") => String(v).trim() !== "";

/**
 * What an evaluator checks on a PPN 006 plan. Required checks block
 * generation; the rest are warnings shown beside the plan.
 */
export function crpReadiness(s: CrpSections, ctx: CrpContext): CrpCheck[] {
  const periodEndYear = ctx.period.endDate.getUTCFullYear();
  const nz = s.targets.netZeroYear === "" ? null : Number(s.targets.netZeroYear);
  const allMeasures = [...s.measures.completed, ...s.measures.planned].filter((m) => filled(m.name));
  const scope3Gaps = ctx.ppnScope3.filter((c) => {
    const row = s.scope3.find((r) => r.code === c.code);
    if (c.tonnes != null && c.tonnes > 0) return false;
    return !row || row.status === "reported" || !filled(row.explanation);
  });
  const badInterim = s.targets.interim.filter(
    (t) => t.year === "" || t.reductionPct === "" || Number(t.year) <= periodEndYear || (nz != null && Number(t.year) > nz),
  );
  const baselineOld = ctx.baseYear ? periodEndYear - ctx.baseYear.endYear : 0;

  const checks: CrpCheck[] = [
    {
      id: "records",
      section: "period",
      label: "Activity records exist for the period",
      required: true,
      passed: ctx.records.total > 0,
      fix: "Import meter, fuel and travel data for the period, or approve field submissions.",
    },
    {
      id: "published",
      section: "emissions",
      label: "Emissions for the period are calculated and published",
      required: true,
      passed: !!ctx.snapshot,
      fix: "Run a calculation and publish it in the Emissions step. The plan reports published figures only.",
    },
    {
      id: "current-run",
      section: "emissions",
      label: "The published figures include the latest calculation",
      required: false,
      passed: !ctx.unpublishedRun,
      fix: "A newer calculation has not been published. Publish it so the plan matches your latest data.",
    },
    {
      id: "scope12",
      section: "emissions",
      label: "Scope 1 and Scope 2 are reported",
      required: true,
      passed: !!ctx.snapshot && ctx.snapshot.totals.s1 + ctx.snapshot.totals.s2 > 0,
      fix: "PPN 006 requires Scope 1 and 2 in full. Add fuel, gas and electricity records for the period.",
    },
    {
      id: "scope3",
      section: "emissions",
      label: "Each required Scope 3 category is reported or explained",
      required: true,
      passed: scope3Gaps.length === 0,
      fix: scope3Gaps.length
        ? `No data or explanation for: ${scope3Gaps.map((c) => c.label).join("; ")}. Report them, or mark why they are not included and explain.`
        : undefined,
    },
    {
      id: "reviewed",
      section: "emissions",
      label: "The published figures have been reviewed and approved",
      required: false,
      passed: ctx.snapshot?.reviewStatus === "approved",
      fix: "Evaluators give more weight to reviewed figures. Approve the snapshot under Calculations.",
    },
    {
      id: "organisation",
      section: "organisation",
      label: "Organisational boundary and sites are described",
      required: true,
      passed: filled(s.organisation.sitesIncluded),
      fix: "Say which sites, companies and activities the plan covers.",
    },
    {
      id: "exclusions",
      section: "organisation",
      label: "Every exclusion has a reason",
      required: true,
      passed: s.organisation.exclusions.every((e) => !filled(e.item) || filled(e.reason)),
      fix: "Give a reason for each excluded site or activity, or remove it.",
    },
    {
      id: "publication",
      section: "organisation",
      label: "Where the plan will be published on your website",
      required: true,
      passed: /^https?:\/\/\S+\.\S+/.test(s.organisation.publicationUrl),
      fix: "PPN 006 requires the plan to be published on your website. Enter the page address.",
    },
    {
      id: "base-year",
      section: "baseline",
      label: "An active base year with measured emissions",
      required: true,
      passed: !!ctx.baseYear && ctx.baseYear.status === "active" && ctx.baseYear.total != null,
      fix: "Choose a baseline period and make it the active base year in the Baseline step.",
    },
    {
      id: "baseline-rationale",
      section: "baseline",
      label: "The reason for choosing the baseline year",
      required: true,
      passed: filled(s.baseline.rationale),
      fix: "The template asks why the baseline year was chosen, for example the first year with complete data.",
    },
    {
      id: "baseline-recent",
      section: "baseline",
      label: "Baseline is recent enough to compare",
      required: false,
      passed: !ctx.baseYear || baselineOld <= 5,
      fix: `The baseline ends ${baselineOld} years before this period. Explain any structural changes since, or recalculate it.`,
    },
    {
      id: "net-zero",
      section: "targets",
      label: "Commitment to net zero by 2050 or earlier",
      required: true,
      passed: nz != null && nz <= 2050 && nz > periodEndYear,
      fix: "PPN 006 requires a net zero commitment no later than 2050.",
    },
    {
      id: "interim",
      section: "targets",
      label: "Interim reduction targets are complete",
      required: true,
      passed: badInterim.length === 0,
      fix: "Each interim target needs a year after this period (and not after net zero) and a reduction percentage.",
    },
    {
      id: "has-interim",
      section: "targets",
      label: "At least one interim target",
      required: false,
      passed: s.targets.interim.length > 0,
      fix: "Evaluators look for a milestone, for example a 2030 reduction against the baseline.",
    },
    {
      id: "measures",
      section: "measures",
      label: "Carbon reduction projects are listed",
      required: true,
      passed: allMeasures.length > 0,
      fix: "List the measures completed since the baseline and those planned for the contract period.",
    },
    {
      id: "measures-complete",
      section: "measures",
      label: "Completed measures since the baseline",
      required: false,
      passed: s.measures.completed.some((m) => filled(m.name)),
      fix: "Add at least one completed measure, with its year and effect.",
    },
    {
      id: "secr",
      section: "secr",
      label: "SECR intensity ratio is complete",
      required: false,
      passed: !s.secr.include || (filled(s.secr.intensityDenominator) && filled(s.secr.intensityValue)),
      fix: "Give the denominator (for example employees or £m turnover) and its value for the period.",
    },
    {
      id: "signatory",
      section: "declaration",
      label: "A director signs the plan off",
      required: true,
      passed: filled(s.declaration.signatoryName) && filled(s.declaration.signatoryTitle) && /^\d{4}-\d{2}-\d{2}$/.test(s.declaration.signedDate),
      fix: "Enter the director's name, job title and the sign-off date.",
    },
    {
      id: "board",
      section: "declaration",
      label: "The board (or equivalent) has approved the plan",
      required: true,
      passed: s.declaration.boardApproved,
      fix: "Confirm board approval.",
    },
    {
      id: "method",
      section: "declaration",
      label: "Reporting standard confirmed",
      required: true,
      passed: s.declaration.methodologyConfirmed,
      fix: "Confirm the emissions follow the GHG Protocol Corporate Standard and the PPN 006 reporting standard.",
    },
  ];
  return checks.map((c) => (c.passed ? { ...c, fix: undefined } : c));
}

export function canGenerate(checks: CrpCheck[]): boolean {
  return checks.every((c) => !c.required || c.passed);
}

// ── Report options built from the plan ────────────────────────────────────────

/** Targets in the shape the PPN 006 template prints, sorted by year. */
export function planTargets(s: CrpSections): { year: number; reductionPct: number; description?: string }[] {
  return s.targets.interim
    .filter((t) => t.year !== "" && t.reductionPct !== "")
    .map((t) => ({
      year: Number(t.year),
      reductionPct: Number(t.reductionPct),
      description: t.scopes === "s1s2s3" ? "Scopes 1, 2 and 3" : "Scopes 1 and 2",
    }))
    .sort((a, b) => a.year - b.year);
}
