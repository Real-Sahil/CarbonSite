// Canonical unit registry for emission categories.
// All conversions are to the canonical unit for each dimension.

type UnitConversion = { toCanonical: number; canonical: string };

const registry: Record<string, UnitConversion> = {
  // Energy - canonical: kWh
  kwh: { toCanonical: 1, canonical: "kWh" },
  mwh: { toCanonical: 1000, canonical: "kWh" },
  gj: { toCanonical: 277.778, canonical: "kWh" },
  mj: { toCanonical: 0.277778, canonical: "kWh" },
  therm: { toCanonical: 29.3071, canonical: "kWh" },

  // Mass - canonical: kg
  kg: { toCanonical: 1, canonical: "kg" },
  tonne: { toCanonical: 1000, canonical: "kg" },
  "metric ton": { toCanonical: 1000, canonical: "kg" },
  "short ton": { toCanonical: 907.185, canonical: "kg" },
  lb: { toCanonical: 0.453592, canonical: "kg" },
  g: { toCanonical: 0.001, canonical: "kg" },

  // Volume - canonical: litre
  litre: { toCanonical: 1, canonical: "litre" },
  liter: { toCanonical: 1, canonical: "litre" },
  l: { toCanonical: 1, canonical: "litre" },
  gallon: { toCanonical: 4.54609, canonical: "litre" }, // UK gallon
  "us gallon": { toCanonical: 3.78541, canonical: "litre" },
  m3: { toCanonical: 1000, canonical: "litre" },

  // Distance - canonical: km
  km: { toCanonical: 1, canonical: "km" },
  mile: { toCanonical: 1.60934, canonical: "km" },
  miles: { toCanonical: 1.60934, canonical: "km" },
  m: { toCanonical: 0.001, canonical: "km" },

  // Currency (spend-based Scope 3) - canonical: GBP
  gbp: { toCanonical: 1, canonical: "GBP" },
};

export type NormalizedUnit = { amount: number; unit: string };

export function normalizeUnit(amount: number, unit: string): NormalizedUnit {
  const entry = registry[unit.toLowerCase().trim()];
  if (!entry) throw new UnitError(`Unsupported unit: ${unit}`);
  return { amount: amount * entry.toCanonical, unit: entry.canonical };
}

export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const a = registry[unitA.toLowerCase().trim()];
  const b = registry[unitB.toLowerCase().trim()];
  return !!a && !!b && a.canonical === b.canonical;
}

export class UnitError extends Error {}
