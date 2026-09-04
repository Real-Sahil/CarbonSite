// Marginal abatement cost curve — the standard construction-industry and
// corporate decarbonisation planning chart: rank reduction initiatives by
// cost per tonne of CO2e abated (cheapest first), and plot cumulative
// abatement on the x-axis against £/tCO2e on the y-axis so the "low-hanging
// fruit" (cheap or even cost-negative measures) are visibly separated from
// expensive ones.
//
// Marginal cost per tCO2e = (annualised capex + annual opex delta) /
// annual abatement. Capex is annualised straight-line over the measure's
// lifetime (total capex / lifetimeYears) rather than NPV-discounted with an
// assumed discount rate — simpler, and doesn't pretend a precision the
// underlying cost estimates don't have. A negative opexDeltaAnnual (the
// measure saves money to run, e.g. lower energy bills) can make the
// marginal cost negative — a classic "win-win" MACC result.

export interface MaccInitiativeInput {
  id: string;
  name: string;
  /** One-off capital cost. */
  capexAmount: number | null;
  /** Ongoing annual cost impact; negative = annual savings. */
  opexDeltaAnnual: number | null;
  /** Useful life in years, used to annualise capex. Null = capex treated as a single year's cost. */
  lifetimeYears: number | null;
  /** Annual abatement, tCO2e. Entries with no positive abatement are excluded — they can't be ranked on a cost-per-tonne axis. */
  expectedImpactCo2e: number | null;
}

export interface MaccEntry {
  id: string;
  name: string;
  abatementTco2e: number;
  annualizedCapex: number;
  totalAnnualCost: number;
  marginalCostPerTco2e: number;
  /** Years for capex to be repaid by opex savings. Null when the measure has no net annual savings — it never "pays back" through opex alone. */
  paybackYears: number | null;
}

export interface MaccCurvePoint extends MaccEntry {
  cumulativeAbatementStartTco2e: number;
  cumulativeAbatementEndTco2e: number;
}

export function computeMacc(initiatives: MaccInitiativeInput[]): MaccEntry[] {
  const entries: MaccEntry[] = [];

  for (const initiative of initiatives) {
    const abatement = initiative.expectedImpactCo2e ?? 0;
    if (abatement <= 0) continue;

    const capex = initiative.capexAmount ?? 0;
    const opex = initiative.opexDeltaAnnual ?? 0;
    const lifetime = initiative.lifetimeYears && initiative.lifetimeYears > 0 ? initiative.lifetimeYears : null;
    const annualizedCapex = lifetime ? capex / lifetime : capex;
    const totalAnnualCost = annualizedCapex + opex;
    const marginalCostPerTco2e = totalAnnualCost / abatement;
    const paybackYears = opex < 0 && capex > 0 ? capex / -opex : null;

    entries.push({
      id: initiative.id,
      name: initiative.name,
      abatementTco2e: abatement,
      annualizedCapex,
      totalAnnualCost,
      marginalCostPerTco2e,
      paybackYears,
    });
  }

  // Cheapest (most cost-negative) first — the standard MACC ranking.
  return entries.sort((a, b) => a.marginalCostPerTco2e - b.marginalCostPerTco2e);
}

/** Adds cumulative-abatement bounds so each entry can be drawn as a bar on a MACC chart, ordered cheapest first. */
export function buildMaccCurve(entries: MaccEntry[]): MaccCurvePoint[] {
  let cumulative = 0;
  return entries.map((entry) => {
    const cumulativeAbatementStartTco2e = cumulative;
    cumulative += entry.abatementTco2e;
    return { ...entry, cumulativeAbatementStartTco2e, cumulativeAbatementEndTco2e: cumulative };
  });
}
