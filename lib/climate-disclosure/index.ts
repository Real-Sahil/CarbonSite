// Climate-related financial disclosure (TCFD structure; IFRS S2 builds on the
// same four pillars). Pure; the loader is ./load.ts.
//
// Built for any organisation in any jurisdiction: nothing here is tied to one
// country's rules, currency or scenario set. Scenario names are the
// organisation's own text (the presets are only well-known public names), the
// risk scale is a plain 1 to 5 likelihood and impact, and the organisation
// writes its own narrative. The TCFD recommendations are the structure, not
// text we copy: labels and guidance below are our own.

import { z } from "zod";

export const HORIZONS = [
  { value: "short", label: "Short term" },
  { value: "medium", label: "Medium term" },
  { value: "long", label: "Long term" },
] as const;
export type Horizon = (typeof HORIZONS)[number]["value"];

export const RISK_KINDS = [
  { value: "physical_acute", label: "Physical, acute (storms, floods, heatwaves)", family: "physical" },
  { value: "physical_chronic", label: "Physical, chronic (sea level, heat, water stress)", family: "physical" },
  { value: "transition_policy", label: "Transition, policy and legal", family: "transition" },
  { value: "transition_technology", label: "Transition, technology", family: "transition" },
  { value: "transition_market", label: "Transition, market", family: "transition" },
  { value: "transition_reputation", label: "Transition, reputation", family: "transition" },
  { value: "opportunity", label: "Opportunity", family: "opportunity" },
] as const;
export type RiskKind = (typeof RISK_KINDS)[number]["value"];
export const riskFamily = (kind: string) => RISK_KINDS.find((k) => k.value === kind)?.family ?? "transition";

export const RISK_STATUSES = [
  { value: "open", label: "Open" },
  { value: "mitigating", label: "Being mitigated" },
  { value: "accepted", label: "Accepted" },
  { value: "closed", label: "Closed" },
] as const;

/** Well-known public scenario sets, offered as suggestions only. The organisation may name any scenario. */
export const SCENARIO_PRESETS = [
  "IPCC SSP1-2.6",
  "IPCC SSP2-4.5",
  "IPCC SSP5-8.5",
  "NGFS Net Zero 2050",
  "NGFS Delayed Transition",
  "NGFS Current Policies",
  "IEA Net Zero Emissions by 2050",
  "IEA Announced Pledges",
  "IEA Stated Policies",
] as const;

const text = (max: number) => z.string().trim().max(max).default("");
const long = text(10_000);

export const scenarioSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  /** Where it comes from, in the organisation's words (publisher, version, temperature outcome). */
  source: text(300),
  /** The organisation says this scenario is consistent with limiting warming to 2°C or lower. */
  lowCarbon: z.boolean().default(false),
  transition: text(3000),
  physical: text(3000),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export const disclosureSectionsSchema = z
  .object({
    governanceBoard: long,
    governanceManagement: long,
    /** What "short", "medium" and "long" mean for this organisation, for example "0 to 2 years". */
    horizons: z.object({ short: text(200), medium: text(200), long: text(200) }).default({}),
    strategyImpact: long,
    scenarioNarrative: long,
    scenarios: z.array(scenarioSchema).max(10).default([]),
    riskIdentification: long,
    riskManagement: long,
    riskIntegration: long,
    metricsNarrative: long,
  })
  .default({});
export type DisclosureSections = z.infer<typeof disclosureSectionsSchema>;

export function parseSections(raw: unknown): DisclosureSections {
  const r = disclosureSectionsSchema.safeParse(raw ?? {});
  return r.success ? r.data : disclosureSectionsSchema.parse({});
}

// ── Risk scoring ──────────────────────────────────────────────────────────────

export const score = (likelihood: number, impact: number) => likelihood * impact;

export type Rating = "low" | "medium" | "high" | "very_high";
export const RATING_LABELS: Record<Rating, string> = { low: "Low", medium: "Medium", high: "High", very_high: "Very high" };

/** Likelihood × impact, each 1 to 5: up to 4 low, 9 medium, 15 high, then very high. */
export function ratingOf(s: number): Rating {
  return s <= 4 ? "low" : s <= 9 ? "medium" : s <= 15 ? "high" : "very_high";
}

export type RiskRow = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  horizon: string;
  inherentLikelihood: number;
  inherentImpact: number;
  residualLikelihood: number | null;
  residualImpact: number | null;
  mitigation: string | null;
  financialEffect: string | null;
  ownerRole: string | null;
  status: string;
};

export const inherentScore = (r: RiskRow) => score(r.inherentLikelihood, r.inherentImpact);
export const residualScore = (r: RiskRow) =>
  r.residualLikelihood != null && r.residualImpact != null ? score(r.residualLikelihood, r.residualImpact) : null;

// ── The 11 recommended disclosures ────────────────────────────────────────────

export type Pillar = "governance" | "strategy" | "risk_management" | "metrics_targets";
export const PILLARS: { value: Pillar; label: string }[] = [
  { value: "governance", label: "Governance" },
  { value: "strategy", label: "Strategy" },
  { value: "risk_management", label: "Risk management" },
  { value: "metrics_targets", label: "Metrics and targets" },
];

export type CheckStatus = "met" | "partial" | "gap";
export type Check = { id: string; code: string; pillar: Pillar; label: string; status: CheckStatus; detail: string };

export type ChecklistInput = {
  sections: DisclosureSections;
  risks: RiskRow[];
  /** The latest published totals, or null when nothing is published. */
  totals: { periodLabel: string; scope3Tonnes: number } | null;
  /** The organisation has a target: a reduction target, an SBTi target or a net zero year. */
  hasTarget: boolean;
};

const filled = (s: string | null | undefined) => !!s && s.trim().length >= 20;

/**
 * One check per TCFD recommended disclosure. A check says, in the
 * organisation's own terms, what is still missing. "Met" means the material is
 * there, not that it is good: the board owns the judgement.
 */
export function tcfdChecklist({ sections: s, risks, totals, hasTarget }: ChecklistInput): Check[] {
  const checks: Check[] = [];
  const add = (id: string, code: string, pillar: Pillar, label: string, status: CheckStatus, detail: string) =>
    checks.push({ id, code, pillar, label, status, detail });

  add(
    "gov-a", "Governance (a)", "governance", "Board oversight of climate-related risks and opportunities",
    filled(s.governanceBoard) ? "met" : "gap",
    filled(s.governanceBoard) ? "Recorded." : "Describe how the board (or equivalent body) oversees climate risks and opportunities, and how often it reviews them.",
  );
  add(
    "gov-b", "Governance (b)", "governance", "Management's role in assessing and managing them",
    filled(s.governanceManagement) ? "met" : "gap",
    filled(s.governanceManagement) ? "Recorded." : "Describe which management roles and committees assess and manage climate risks and how they report to the board.",
  );

  const horizonsDefined = HORIZONS.every((h) => s.horizons[h.value].trim().length >= 3);
  const families = new Set(risks.map((r) => riskFamily(r.kind)));
  const strA: CheckStatus =
    risks.length === 0 ? "gap" : horizonsDefined && families.has("physical") && families.has("transition") ? "met" : "partial";
  add(
    "str-a", "Strategy (a)", "strategy", "Risks and opportunities identified over the short, medium and long term",
    strA,
    risks.length === 0
      ? "No risks or opportunities recorded. Add them to the register."
      : strA === "met"
        ? `${risks.length} recorded, covering physical and transition risk, with the time horizons defined.`
        : [
            !horizonsDefined ? "Define what short, medium and long term mean for you." : null,
            !families.has("physical") ? "No physical risk recorded." : null,
            !families.has("transition") ? "No transition risk recorded." : null,
          ].filter(Boolean).join(" "),
  );
  add(
    "str-b", "Strategy (b)", "strategy", "Impact on the business, strategy and financial planning",
    filled(s.strategyImpact) ? "met" : "gap",
    filled(s.strategyImpact) ? "Recorded." : "Explain how these risks and opportunities affect your business, strategy and financial planning.",
  );

  const lowCarbon = s.scenarios.some((x) => x.lowCarbon);
  const strC: CheckStatus =
    s.scenarios.length >= 2 && lowCarbon && filled(s.scenarioNarrative) ? "met" : s.scenarios.length > 0 || filled(s.scenarioNarrative) ? "partial" : "gap";
  add(
    "str-c", "Strategy (c)", "strategy", "Resilience of the strategy under different climate scenarios",
    strC,
    strC === "met"
      ? `${s.scenarios.length} scenarios, including one consistent with 2°C or lower.`
      : [
          s.scenarios.length < 2 ? "Use at least two scenarios." : null,
          !lowCarbon ? "Include a scenario consistent with limiting warming to 2°C or lower and mark it." : null,
          !filled(s.scenarioNarrative) ? "Describe how resilient your strategy is across them." : null,
        ].filter(Boolean).join(" "),
  );

  add(
    "rm-a", "Risk management (a)", "risk_management", "Processes for identifying and assessing climate-related risks",
    filled(s.riskIdentification) && risks.length > 0 ? "met" : filled(s.riskIdentification) || risks.length > 0 ? "partial" : "gap",
    filled(s.riskIdentification) && risks.length > 0
      ? "Process described and risks scored in the register."
      : "Describe how you identify and assess climate risks, and score them in the register.",
  );
  const unmitigated = risks.filter((r) => r.status !== "closed" && !filled(r.mitigation));
  add(
    "rm-b", "Risk management (b)", "risk_management", "Processes for managing climate-related risks",
    filled(s.riskManagement) ? (unmitigated.length === 0 ? "met" : "partial") : "gap",
    !filled(s.riskManagement)
      ? "Describe how you manage, prioritise and monitor climate risks."
      : unmitigated.length === 0
        ? "Recorded, and every open risk has a response."
        : `${unmitigated.length} open risk(s) have no response recorded.`,
  );
  add(
    "rm-c", "Risk management (c)", "risk_management", "Integration into overall risk management",
    filled(s.riskIntegration) ? "met" : "gap",
    filled(s.riskIntegration) ? "Recorded." : "Explain how climate risk fits into your overall risk management process.",
  );

  add(
    "mt-a", "Metrics and targets (a)", "metrics_targets", "Metrics used to assess climate risks and opportunities",
    filled(s.metricsNarrative) ? "met" : "gap",
    filled(s.metricsNarrative) ? "Recorded." : "State the metrics you use to assess climate risks and opportunities, and how they feed decisions.",
  );
  add(
    "mt-b", "Metrics and targets (b)", "metrics_targets", "Scope 1, 2 and, if appropriate, 3 greenhouse gas emissions",
    !totals ? "gap" : totals.scope3Tonnes > 0 ? "met" : "partial",
    !totals
      ? "No published totals yet. Publish a snapshot."
      : totals.scope3Tonnes > 0
        ? `Published totals for ${totals.periodLabel} include Scope 3.`
        : `Published totals for ${totals.periodLabel} have no Scope 3. Add it if it is material.`,
  );
  add(
    "mt-c", "Metrics and targets (c)", "metrics_targets", "Targets and performance against them",
    hasTarget ? "met" : "gap",
    hasTarget ? "A target is recorded." : "Set a reduction target, an SBTi target or a net zero year.",
  );

  return checks;
}

export function coverage(checks: Check[]) {
  const met = checks.filter((c) => c.status === "met").length;
  return { met, total: checks.length };
}

/**
 * Whether the statement may say it is consistent with the recommendations:
 * every disclosure is met and the board (or equivalent body) has approved this
 * version. Otherwise the report states how many are addressed and no more.
 */
export function mayClaimConsistency(checks: Check[], approved: boolean): boolean {
  return approved && checks.length > 0 && checks.every((c) => c.status === "met");
}

/**
 * Where each recommended disclosure sits in IFRS S2, by area of the standard
 * (not paragraph numbers). Indicative: the standard itself is the authority,
 * and a jurisdiction may adopt it with changes.
 */
export const IFRS_S2_AREAS: Record<string, string> = {
  "gov-a": "Governance: the body responsible for oversight",
  "gov-b": "Governance: management's role",
  "str-a": "Strategy: climate-related risks and opportunities, and time horizons",
  "str-b": "Strategy: business model and value chain, strategy and decision-making, financial position and performance",
  "str-c": "Strategy: climate resilience, using scenario analysis",
  "rm-a": "Risk management: identifying, assessing, prioritising and monitoring",
  "rm-b": "Risk management: identifying, assessing, prioritising and monitoring",
  "rm-c": "Risk management: integration into overall risk management",
  "mt-a": "Metrics and targets: climate-related metrics",
  "mt-b": "Metrics and targets: Scope 1, 2 and 3 greenhouse gas emissions",
  "mt-c": "Metrics and targets: climate-related targets and progress",
};

export const FRAMEWORK_NOTE =
  "The structure follows the four pillars and eleven recommended disclosures of the Task Force on Climate-related Financial Disclosures (TCFD). IFRS S2 Climate-related Disclosures builds on the same pillars. Whether and how a climate disclosure is required depends on the organisation's jurisdiction and legal form.";
