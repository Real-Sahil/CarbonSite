// Turns ReductionInitiative rows into MACC inputs in one currency. Each
// initiative carries its own costCurrency; ranking £ against € per tonne
// would compare unlike numbers, so costs are converted to the organisation's
// reporting currency (ECB rate for today, else the built-in rate). An
// initiative whose currency cannot be converted is left off the curve and
// named, rather than ranked on the wrong scale.

import { convertCurrency, prefetchFxRatesOn } from "@/lib/calculation/units";
import type { MaccInitiativeInput } from "./macc";

export type InitiativeCostRow = {
  id: string;
  name: string;
  capexAmount: unknown;
  costAmount: unknown;
  costCurrency: string | null;
  opexDeltaAnnual: unknown;
  lifetimeYears: number | null;
  /** kgCO2e a year, as stored. */
  expectedImpactCo2e: unknown;
};

const num = (v: unknown) => (v == null ? null : Number(v));

export type Converter = (amount: number, from: string, to: string) => number | null;

/** Pure: initiatives to MACC inputs (tCO2e, reporting currency). */
export function maccInputsIn(rows: InitiativeCostRow[], currency: string, convert: Converter) {
  const inputs: MaccInitiativeInput[] = [];
  const unconverted: string[] = [];
  for (const r of rows) {
    const from = (r.costCurrency ?? "GBP").toUpperCase();
    const capexRaw = num(r.capexAmount) ?? num(r.costAmount);
    const opexRaw = num(r.opexDeltaAnnual);
    const conv = (v: number | null) => (v == null ? null : from === currency ? v : convert(v, from, currency));
    const capex = conv(capexRaw);
    const opex = conv(opexRaw);
    if ((capexRaw != null && capex == null) || (opexRaw != null && opex == null)) {
      unconverted.push(r.name);
      continue;
    }
    inputs.push({
      id: r.id,
      name: r.name,
      capexAmount: capex,
      opexDeltaAnnual: opex,
      lifetimeYears: r.lifetimeYears,
      expectedImpactCo2e: num(r.expectedImpactCo2e) == null ? null : num(r.expectedImpactCo2e)! / 1000,
    });
  }
  return { inputs, unconverted };
}

/** Server: loads today's ECB rates first, then converts. */
export async function maccInputsInCurrency(rows: InitiativeCostRow[], currency: string) {
  const today = new Date();
  if (rows.some((r) => (r.costCurrency ?? "GBP").toUpperCase() !== currency)) {
    await prefetchFxRatesOn([today]).catch(() => undefined);
  }
  return maccInputsIn(rows, currency, (amount, from, to) => convertCurrency(amount, from, to, today)?.amount ?? null);
}

/** A price per tonne in the reporting currency, or null when it cannot be converted. */
export function priceIn(price: { pricePerTonne: number; currency: string }, currency: string): number | null {
  if (price.currency.toUpperCase() === currency) return price.pricePerTonne;
  return convertCurrency(price.pricePerTonne, price.currency, currency, new Date())?.amount ?? null;
}
