// Climate-related financial disclosure (TCFD structure; IFRS S2 builds on the
// same four pillars). Pure; the loader is ./load.ts.
//
// The scenarios and risks the statement reports are the organisation's TCFD
// scenarios and risk assessments (the TCFD page); this module adds the
// narrative, the checklist of the eleven recommended disclosures and the board
// approval. Built for any organisation in any jurisdiction: nothing here is
// tied to one country's rules, currency or scenario set, and the organisation
// writes its own narrative. The TCFD recommendations are the structure, not
// text we copy: labels and guidance below are our own.

import { z } from "zod";

/** The time horizons the TCFD page records on each scenario. */
export const HORIZONS = [
  { value: "short", label: "Short term", meaning: "Up to 3 years" },
  { value: "medium", label: "Medium term", meaning: "3 to 10 years" },
  { value: "long", label: "Long term", meaning: "Beyond 10 years" },
] as const;
export const horizonLabel = (h: string) => HORIZONS.find((x) => x.value === h)?.label ?? h;

const long = z.string().trim().max(10_000).default("");

export const disclosureSectionsSchema = z
  .object({
    governanceBoard: long,
    governanceManagement: long,
    strategyImpact: long,
    /** How resilient the strategy is across the scenarios on the TCFD page. */
    scenarioNarrative: long,
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

// ── Scenarios and risks, as the TCFD page records them ────────────────────────

export type ScenarioRow = {
  id: string;
  name: string;
  type: "physical" | "transition";
  /** The organisation's own label, such as "1.5°C" or "Net Zero 2050". */
  pathway: string | null;
  horizon: string;
  description: string | null;
  valueAtRiskLow: number | null;
  valueAtRiskHigh: number | null;
};

export type RiskRow = {
  id: string;
  scenarioId: string;
  category: string;
  description: string;
  likelihood: number;
  impact: number;
  residualLikelihood: number | null;
  residualImpact: number | null;
  financialLow: number | null;
  financialHigh: number | null;
  actions: string | null;
  reviewDate: Date | null;
};

/**
 * Whether a pathway label reads as consistent with limiting warming to 2°C or
 * lower: it names net zero, "below 2", 1.5 or Paris, or gives a temperature of
 * 2 or less. A heuristic on the organisation's own wording; the checklist says
 * so when it matters.
 */
export function isLowCarbonPathway(pathway: string | null | undefined): boolean {
  const t = (pathway ?? "").toLowerCase();
  if (/net.?zero|below\s*2|well.?below|1\.5|paris/.test(t)) return true;
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*°?\s*c\b/);
  return m ? parseFloat(m[1].replace(",", ".")) <= 2 : false;
}

export type RiskFamily = "physical" | "transition" | "opportunity";

/** An assessment is an opportunity when its category or description says so; otherwise it takes its scenario's type. */
export function riskFamily(r: Pick<RiskRow, "category" | "description">, scenario: Pick<ScenarioRow, "type"> | undefined): RiskFamily {
  if (/opportunit/i.test(`${r.category} ${r.description}`)) return "opportunity";
  return scenario?.type ?? "transition";
}

// ── Risk scoring ──────────────────────────────────────────────────────────────

export const score = (likelihood: number, impact: number) => likelihood * impact;

export type Rating = "low" | "medium" | "high" | "very_high";
export const RATING_LABELS: Record<Rating, string> = { low: "Low", medium: "Medium", high: "High", very_high: "Very high" };

/** Likelihood × impact, each 1 to 5: up to 4 low, 9 medium, 15 high, then very high. */
export function ratingOf(s: number): Rating {
  return s <= 4 ? "low" : s <= 9 ? "medium" : s <= 15 ? "high" : "very_high";
}

export const inherentScore = (r: RiskRow) => score(r.likelihood, r.impact);
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
export type Check = { id: string; code: string; pillar: Pillar; label: string; status: CheckStatus; detail: string; link?: { label: string; path: string } };

/** Where to go for checks whose answer lives on another page; narrative checks are written on this page. */
export const CHECK_LINKS: Record<string, { label: string; path: string }> = {
  "str-a": { label: "Add scenarios and assess risks", path: "tcfd" },
  "str-c": { label: "Add a scenario", path: "tcfd" },
  "rm-a": { label: "Score risks", path: "tcfd" },
  "rm-b": { label: "Add actions to risks", path: "tcfd" },
  "mt-a": { label: "Run and publish a calculation", path: "calculations" },
  "mt-b": { label: "Add Scope 3 records", path: "records" },
  "mt-c": { label: "Set a target", path: "targets" },
};

export type ChecklistInput = {
  sections: DisclosureSections;
  scenarios: ScenarioRow[];
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
export function tcfdChecklist({ sections: s, scenarios, risks, totals, hasTarget }: ChecklistInput): Check[] {
  const checks: Check[] = [];
  const add = (id: string, code: string, pillar: Pillar, label: string, status: CheckStatus, detail: string) =>
    checks.push({ id, code, pillar, label, status, detail });
  const byScenario = new Map(scenarios.map((x) => [x.id, x]));

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

  const families = new Set(risks.map((r) => riskFamily(r, byScenario.get(r.scenarioId))));
  const strA: CheckStatus = risks.length === 0 ? "gap" : families.has("physical") && families.has("transition") ? "met" : "partial";
  add(
    "str-a", "Strategy (a)", "strategy", "Risks and opportunities identified over the short, medium and long term",
    strA,
    risks.length === 0
      ? "No risks assessed. Add scenarios and assess risks on the TCFD scenarios page."
      : strA === "met"
        ? `${risks.length} risk${risks.length === 1 ? "" : "s"} assessed, covering physical and transition risk.`
        : [
            !families.has("physical") ? "No physical risk assessed." : null,
            !families.has("transition") ? "No transition risk assessed." : null,
          ].filter(Boolean).join(" "),
  );
  add(
    "str-b", "Strategy (b)", "strategy", "Impact on the business, strategy and financial planning",
    filled(s.strategyImpact) ? "met" : "gap",
    filled(s.strategyImpact) ? "Recorded." : "Explain how these risks and opportunities affect your business, strategy and financial planning.",
  );

  const lowCarbon = scenarios.some((x) => isLowCarbonPathway(x.pathway));
  const strC: CheckStatus =
    scenarios.length >= 2 && lowCarbon && filled(s.scenarioNarrative) ? "met" : scenarios.length > 0 || filled(s.scenarioNarrative) ? "partial" : "gap";
  add(
    "str-c", "Strategy (c)", "strategy", "Resilience of the strategy under different climate scenarios",
    strC,
    strC === "met"
      ? `${scenarios.length} scenarios, including one consistent with 2°C or lower.`
      : [
          scenarios.length < 2 ? "Use at least two scenarios." : null,
          !lowCarbon ? "Include a scenario consistent with limiting warming to 2°C or lower, and name its pathway (for example 1.5°C or Net Zero 2050)." : null,
          !filled(s.scenarioNarrative) ? "Describe how resilient your strategy is across them." : null,
        ].filter(Boolean).join(" "),
  );

  add(
    "rm-a", "Risk management (a)", "risk_management", "Processes for identifying and assessing climate-related risks",
    filled(s.riskIdentification) && risks.length > 0 ? "met" : filled(s.riskIdentification) || risks.length > 0 ? "partial" : "gap",
    filled(s.riskIdentification) && risks.length > 0
      ? "Process described and risks scored."
      : "Describe how you identify and assess climate risks, and score them on the TCFD scenarios page.",
  );
  const unmitigated = risks.filter((r) => !r.actions || r.actions.trim().length === 0);
  add(
    "rm-b", "Risk management (b)", "risk_management", "Processes for managing climate-related risks",
    filled(s.riskManagement) ? (unmitigated.length === 0 ? "met" : "partial") : "gap",
    !filled(s.riskManagement)
      ? "Describe how you manage, prioritise and monitor climate risks."
      : unmitigated.length === 0
        ? "Recorded, and every assessed risk has an action."
        : `${unmitigated.length} assessed risk(s) have no adaptation action recorded.`,
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

  return checks.map((c) => (c.status === "met" ? c : { ...c, link: CHECK_LINKS[c.id] }));
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
