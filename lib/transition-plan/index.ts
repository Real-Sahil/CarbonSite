// Climate transition plan: the decarbonisation pathway and the ESRS E1-1 /
// UK Transition Plan Taskforce checklist. Pure; the loader is ./load.ts.
//
// Pathway lines, all in tCO2e per year from the base year:
//   reference  the 1.5°C benchmark: base-year emissions cut by 4.2% of the
//              base each year (SBTi's minimum absolute contraction rate for
//              1.5°C), floored at a 90% cut (the SBTi Net-Zero Standard's
//              long-term reduction). A benchmark, not the org's target.
//   target     the org's own SBTi target line, when one is set.
//   planned    base-year emissions less the annual abatement of every
//              scheduled, uncancelled reduction initiative from the year it
//              starts. Initiatives with no start date are left off the line
//              and counted separately, so the plan never claims them.
//   actual     published totals by year.

export const ACA_RATE_1_5C = 0.042;
export const LONG_TERM_CUT = 0.9;

export type Lever = {
  id: string;
  name: string;
  status: string;
  /** Annual abatement, tCO2e. */
  abatementTco2e: number | null;
  startYear: number | null;
  capex: number | null;
};

export type PathwayInput = {
  baseYear: number;
  baseTco2e: number;
  endYear: number;
  targetForYear?: ((year: number) => number) | null;
  actualByYear: Map<number, number>;
  levers: Lever[];
};

export type PathwayPoint = {
  year: number;
  reference: number;
  target: number | null;
  planned: number;
  actual: number | null;
};

export function referenceTco2e(baseTco2e: number, baseYear: number, year: number): number {
  const cut = Math.min(LONG_TERM_CUT, Math.max(0, (year - baseYear) * ACA_RATE_1_5C));
  return baseTco2e * (1 - cut);
}

/** Levers that count toward the planned line. */
export const scheduled = (l: Lever) => l.status !== "canceled" && l.startYear != null && (l.abatementTco2e ?? 0) > 0;

export function buildPathway(input: PathwayInput): PathwayPoint[] {
  const points: PathwayPoint[] = [];
  const levers = input.levers.filter(scheduled);
  for (let year = input.baseYear; year <= input.endYear; year++) {
    const abated = levers.filter((l) => l.startYear! <= year).reduce((t, l) => t + (l.abatementTco2e ?? 0), 0);
    points.push({
      year,
      reference: referenceTco2e(input.baseTco2e, input.baseYear, year),
      target: input.targetForYear ? input.targetForYear(year) : null,
      planned: Math.max(0, input.baseTco2e - abated),
      actual: input.actualByYear.get(year) ?? null,
    });
  }
  return points;
}

export type Gap = { year: number; planned: number; goal: number; gapTco2e: number; against: "target" | "reference" };

/** Shortfall of the planned line against the target (or the 1.5°C reference when there is no target) at a year. */
export function gapAt(points: PathwayPoint[], year: number): Gap | null {
  const p = points.find((x) => x.year === year);
  if (!p) return null;
  const goal = p.target ?? p.reference;
  return { year, planned: p.planned, goal, gapTco2e: p.planned - goal, against: p.target != null ? "target" : "reference" };
}

/** Annual linear reduction rate implied by a near-term target, as a share of the base. */
export function annualRate(baseYear: number, targetYear: number, reductionPct: number): number | null {
  const years = targetYear - baseYear;
  return years > 0 ? reductionPct / 100 / years : null;
}

export type CheckStatus = "met" | "partial" | "gap";
export type Check = { id: string; code: string; label: string; status: CheckStatus; detail: string };

export type PlanFields = {
  status: string;
  ambition: string | null;
  netZeroYear: number | null;
  strategy: string | null;
  engagement: string | null;
  governance: string | null;
  lockedInEmissions: string | null;
  capexPlanned: number | null;
  opexPlanned: number | null;
  taxonomyAlignedCapexPct: number | null;
  approvalBody: string | null;
  approvedAt: Date | null;
};

const filled = (s: string | null | undefined) => !!s && s.trim().length >= 20;

/**
 * ESRS E1-1 paragraph 16 (with the UK TPT's ambition / action /
 * accountability headings in the labels). Each item says what is missing in
 * the organisation's own terms.
 */
export function transitionChecklist(input: {
  plan: PlanFields | null;
  target: { baseYear: number; nearTermYear: number; nearTermReductionPct: number; netZeroYear: number; coversScope3: boolean } | null;
  levers: Lever[];
  nearTermGap: Gap | null;
  latestActual: { year: number; actual: number; expected: number } | null;
}): Check[] {
  const { plan, target, levers } = input;
  const live = levers.filter((l) => l.status !== "canceled");
  const quantified = live.filter((l) => (l.abatementTco2e ?? 0) > 0);
  const sched = live.filter(scheduled);
  const rate = target ? annualRate(target.baseYear, target.nearTermYear, target.nearTermReductionPct) : null;
  const checks: Check[] = [];

  checks.push({
    id: "targets",
    code: "E1-1 16(a)",
    label: "Ambition: targets compatible with 1.5°C",
    status: !target ? "gap" : rate != null && rate >= ACA_RATE_1_5C && target.netZeroYear <= 2050 ? (target.coversScope3 ? "met" : "partial") : "partial",
    detail: !target
      ? "No SBTi target set. Set one on the SBTi Roadmap page."
      : rate != null && rate < ACA_RATE_1_5C
        ? `The near-term target cuts ${(rate * 100).toFixed(1)}% of base-year emissions a year; 1.5°C needs at least ${(ACA_RATE_1_5C * 100).toFixed(1)}%.`
        : target.netZeroYear > 2050
          ? `Net zero in ${target.netZeroYear} is later than 2050.`
          : !target.coversScope3
            ? "The target has no Scope 3 baseline. Add it if Scope 3 is material."
            : `${(rate! * 100).toFixed(1)}% a year to ${target.nearTermYear}, net zero by ${target.netZeroYear}.`,
  });

  checks.push({
    id: "levers",
    code: "E1-1 16(b)",
    label: "Action: decarbonisation levers quantified",
    status: live.length === 0 ? "gap" : quantified.length === live.length ? "met" : "partial",
    detail:
      live.length === 0
        ? "No reduction initiatives recorded. Add them on the Targets page."
        : `${quantified.length} of ${live.length} initiatives have an expected annual abatement.`,
  });

  checks.push({
    id: "schedule",
    code: "E1-1 16(b)",
    label: "Action: levers scheduled",
    status: quantified.length === 0 ? "gap" : sched.length === quantified.length ? "met" : "partial",
    detail:
      quantified.length === 0
        ? "Nothing to schedule yet."
        : sched.length === quantified.length
          ? "Every quantified initiative has a start date."
          : `${quantified.length - sched.length} quantified initiative(s) have no start date, so they are left off the planned line.`,
  });

  const g = input.nearTermGap;
  checks.push({
    id: "gap",
    code: "E1-1 16(b)",
    label: "Action: levers close the gap to the near-term goal",
    status: !g ? "gap" : g.gapTco2e <= 0 ? "met" : "partial",
    detail: !g
      ? "Needs a base year and scheduled initiatives."
      : g.gapTco2e <= 0
        ? `Scheduled initiatives reach the ${g.against === "target" ? "target" : "1.5°C benchmark"} for ${g.year}.`
        : `Scheduled initiatives leave ${g.gapTco2e.toLocaleString("en-GB", { maximumFractionDigits: 0 })} tCO2e a year still to find by ${g.year}.`,
  });

  const capexFromLevers = live.reduce((t, l) => t + (l.capex ?? 0), 0);
  checks.push({
    id: "funding",
    code: "E1-1 16(c)",
    label: "Action: investment and funding",
    status: plan?.capexPlanned != null || plan?.opexPlanned != null ? "met" : capexFromLevers > 0 ? "partial" : "gap",
    detail:
      plan?.capexPlanned != null || plan?.opexPlanned != null
        ? "Planned capital and operating spend recorded."
        : capexFromLevers > 0
          ? "Initiatives carry capex, but the plan does not state the total investment and how it is funded."
          : "Record the capital and operating spend the plan needs.",
  });

  checks.push({
    id: "locked-in",
    code: "E1-1 16(d)",
    label: "Locked-in emissions assessed",
    status: filled(plan?.lockedInEmissions) ? "met" : "gap",
    detail: filled(plan?.lockedInEmissions)
      ? "Assessment recorded."
      : "Describe emissions locked in by key assets and products (plant, fleet, buildings, long contracts) and how the plan deals with them.",
  });

  checks.push({
    id: "taxonomy",
    code: "E1-1 16(e)",
    label: "EU Taxonomy-aligned capex",
    status: plan?.taxonomyAlignedCapexPct != null ? "met" : "partial",
    detail:
      plan?.taxonomyAlignedCapexPct != null
        ? `${plan.taxonomyAlignedCapexPct}% of planned capex is Taxonomy-aligned.`
        : "Only needed where the Taxonomy applies to you. Leave blank otherwise.",
  });

  checks.push({
    id: "strategy",
    code: "E1-1 16(g)",
    label: "Embedded in strategy and financial planning",
    status: filled(plan?.strategy) ? "met" : "gap",
    detail: filled(plan?.strategy) ? "Recorded." : "Explain how the plan feeds the business strategy, budgets and investment decisions.",
  });

  checks.push({
    id: "engagement",
    code: "TPT 3",
    label: "Engagement: value chain, industry and policy",
    status: filled(plan?.engagement) ? "met" : "gap",
    detail: filled(plan?.engagement) ? "Recorded." : "Describe how you work with suppliers, customers, peers and government to deliver the plan.",
  });

  checks.push({
    id: "governance",
    code: "E1-1 16(h)",
    label: "Accountability: approved by the board",
    status: plan?.status === "approved" && plan.approvedAt ? (filled(plan.governance) ? "met" : "partial") : "gap",
    detail:
      plan?.status === "approved" && plan.approvedAt
        ? `Approved by ${plan.approvalBody ?? "the board"} on ${plan.approvedAt.toISOString().slice(0, 10)}.${filled(plan.governance) ? "" : " Add who oversees delivery and how."}`
        : "Not yet approved by the administrative, management or supervisory body.",
  });

  const a = input.latestActual;
  checks.push({
    id: "progress",
    code: "E1-1 16(j)",
    label: "Progress against the plan",
    status: !a ? "gap" : a.actual <= a.expected * 1.05 ? "met" : "partial",
    detail: !a
      ? "No published totals yet for a year on the pathway."
      : `${a.year}: ${a.actual.toLocaleString("en-GB", { maximumFractionDigits: 0 })} tCO2e against ${a.expected.toLocaleString("en-GB", { maximumFractionDigits: 0 })} on the line${a.actual > a.expected * 1.05 ? ", behind" : ", on track"}.`,
  });

  return checks;
}
