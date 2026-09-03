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
  kgs: { toCanonical: 1, canonical: "kg" },
  tonne: { toCanonical: 1000, canonical: "kg" },
  // The mobile capture form and OCR emit the plural / abbreviated forms.
  tonnes: { toCanonical: 1000, canonical: "kg" },
  t: { toCanonical: 1000, canonical: "kg" },
  "metric ton": { toCanonical: 1000, canonical: "kg" },
  "short ton": { toCanonical: 907.185, canonical: "kg" },
  lb: { toCanonical: 0.453592, canonical: "kg" },
  lbs: { toCanonical: 0.453592, canonical: "kg" },
  g: { toCanonical: 0.001, canonical: "kg" },

  // Volume - canonical: litre
  litre: { toCanonical: 1, canonical: "litre" },
  litres: { toCanonical: 1, canonical: "litre" },
  liter: { toCanonical: 1, canonical: "litre" },
  liters: { toCanonical: 1, canonical: "litre" },
  l: { toCanonical: 1, canonical: "litre" },
  gallon: { toCanonical: 4.54609, canonical: "litre" }, // UK gallon
  gallons: { toCanonical: 4.54609, canonical: "litre" },
  "us gallon": { toCanonical: 3.78541, canonical: "litre" },
  "us gallons": { toCanonical: 3.78541, canonical: "litre" },
  m3: { toCanonical: 1000, canonical: "litre" },

  // Discrete count (delivery notes) - canonical: unit
  unit: { toCanonical: 1, canonical: "unit" },
  units: { toCanonical: 1, canonical: "unit" },
  item: { toCanonical: 1, canonical: "unit" },
  items: { toCanonical: 1, canonical: "unit" },
  each: { toCanonical: 1, canonical: "unit" },

  // Distance - canonical: km
  km: { toCanonical: 1, canonical: "km" },
  mile: { toCanonical: 1.60934, canonical: "km" },
  miles: { toCanonical: 1.60934, canonical: "km" },
  m: { toCanonical: 0.001, canonical: "km" },

  // Currency (spend-based Scope 3) - canonical: GBP
  // Non-GBP rates are approximate; use live exchange rates in production.
  gbp: { toCanonical: 1, canonical: "GBP" },
  GBP: { toCanonical: 1, canonical: "GBP" },
  usd: { toCanonical: 0.79, canonical: "GBP" },
  USD: { toCanonical: 0.79, canonical: "GBP" },
  eur: { toCanonical: 0.86, canonical: "GBP" },
  EUR: { toCanonical: 0.86, canonical: "GBP" },
  cad: { toCanonical: 0.58, canonical: "GBP" },
  CAD: { toCanonical: 0.58, canonical: "GBP" },
  aud: { toCanonical: 0.51, canonical: "GBP" },
  AUD: { toCanonical: 0.51, canonical: "GBP" },

  // Freight transport - canonical: tonne.km
  "tonne.km": { toCanonical: 1, canonical: "tonne.km" },
  "tonne-km": { toCanonical: 1, canonical: "tonne.km" },
  tkm: { toCanonical: 1, canonical: "tonne.km" },
  "t.km": { toCanonical: 1, canonical: "tonne.km" },

  // Passenger transport - canonical: pkm (maps to km dimension with pkm label)
  pkm: { toCanonical: 1, canonical: "pkm" },
  "passenger.km": { toCanonical: 1, canonical: "pkm" },
  "passenger-km": { toCanonical: 1, canonical: "pkm" },
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

/// Converts an amount between two units of the same dimension.
/// Returns null when either unit is unknown or the dimensions differ —
/// callers must treat null as "cannot calculate", never multiply through.
export function convertBetween(
  amount: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  const from = registry[fromUnit.toLowerCase().trim()];
  const to = registry[toUnit.toLowerCase().trim()];
  if (!from || !to || from.canonical !== to.canonical) return null;
  return (amount * from.toCanonical) / to.toCanonical;
}

export class UnitError extends Error {}
