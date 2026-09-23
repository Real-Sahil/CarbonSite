// Canonical unit registry for emission categories.
// All conversions are to the canonical unit for each dimension.

type UnitConversion = { toCanonical: number; canonical: string };

// ---------------------------------------------------------------------------
// Live FX cache — populated by refreshFxRates() before each calculation run.
// Falls back to the hardcoded rates below when Frankfurter is unavailable.
// Keys are uppercase ISO-4217 currency codes; values are GBP equivalent of 1 unit.
// ---------------------------------------------------------------------------
let liveFxRates: Record<string, number> = {};
let liveFxFetchedAt = 0;
const FX_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Fetch the latest ECB FX rates from Frankfurter and cache them.
 * Silently falls back to hardcoded rates on any error.
 * Call once at the start of each calculation run.
 */
export async function refreshFxRates(): Promise<void> {
  if (Date.now() - liveFxFetchedAt < FX_TTL_MS) return; // still fresh
  try {
    const { getLatestRatesGbp } = await import("@/lib/data-sources/frankfurter");
    const rates = await getLatestRatesGbp();
    // rates is { USD: 1.27, EUR: 1.16, ... } (1 GBP = x foreign)
    // We need the inverse: 1 foreign = y GBP
    const incoming: Record<string, number> = {};
    for (const [ccy, perGbp] of Object.entries(rates)) {
      if (perGbp > 0) incoming[ccy.toUpperCase()] = 1 / perGbp;
    }
    incoming["GBP"] = 1;
    liveFxRates = incoming;
    liveFxFetchedAt = Date.now();
  } catch {
    // leave liveFxRates as-is (empty or stale) — hardcoded fallback will apply
  }
}

// Rates for the day each spend happened, keyed by YYYY-MM-DD. Spend-based
// Scope 3 must convert at the rate on the transaction date: converting a 2024
// invoice at today's rate makes the figure move every time it is recalculated.
// Values are GBP per 1 unit of the currency. `asOf` is the ECB business day the
// rates are for, which is earlier than the key on weekends and holidays.
const datedFx = new Map<string, { asOf: string; rates: Record<string, number> }>();

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
// Days whose fetch failed recently, so an outage costs one timeout, not one per page.
const failedFxDays = new Map<string, number>();
const FX_RETRY_MS = 10 * 60 * 1000;

/** Fetch ECB rates for each day not already cached. Failures leave the day uncached. */
export async function prefetchFxRatesOn(days: Date[]): Promise<void> {
  const now = Date.now();
  const missing = [...new Set(days.map(isoDay))].filter(
    (d) => !datedFx.has(d) && now - (failedFxDays.get(d) ?? 0) > FX_RETRY_MS,
  );
  if (missing.length === 0) return;
  const { getRatesGbpOn } = await import("@/lib/data-sources/frankfurter");
  await Promise.all(
    missing.map(async (day) => {
      try {
        const res = await getRatesGbpOn(day);
        const rates: Record<string, number> = { GBP: 1 };
        for (const [ccy, perGbp] of Object.entries(res.rates)) if (perGbp > 0) rates[ccy.toUpperCase()] = 1 / perGbp;
        datedFx.set(day, { asOf: res.date, rates });
      } catch {
        // Leave uncached; the latest or built-in rate applies, and the
        // calculation says so in its provenance.
        failedFxDays.set(day, Date.now());
      }
    }),
  );
}

/** Test hook: seed the dated cache without the network. */
export function setFxRatesOn(day: string, asOf: string, gbpPerUnit: Record<string, number>): void {
  datedFx.set(day, { asOf, rates: { GBP: 1, ...gbpPerUnit } });
}

export function isCurrencyUnit(unit: string): boolean {
  return registry[unit.toLowerCase().trim()]?.canonical === "GBP" || liveFxRates[unit.toUpperCase().trim()] !== undefined;
}

/// GBP per 1 unit of `currency`, preferring the rate for `onDate`.
function gbpRate(currency: string, onDate?: Date | null): FxProvenance | null {
  const ccy = currency.toUpperCase().trim();
  if (ccy === "GBP") return { currency: ccy, rate: 1, source: "live", fetchedAt: null };
  if (onDate) {
    const day = datedFx.get(isoDay(onDate));
    if (day?.rates[ccy] !== undefined) {
      return { currency: ccy, rate: day.rates[ccy], source: "dated", fetchedAt: null, rateDate: day.asOf };
    }
  }
  if (liveFxRates[ccy] !== undefined) {
    return { currency: ccy, rate: liveFxRates[ccy], source: "live", fetchedAt: liveFxFetchedAt ? new Date(liveFxFetchedAt) : null };
  }
  const entry = registry[ccy.toLowerCase()];
  if (entry?.canonical === "GBP") return { currency: ccy, rate: entry.toCanonical, source: "fallback", fetchedAt: null };
  return null;
}

/**
 * Convert between two currencies at the rate for `onDate` (falling back to the
 * latest, then the built-in rate). Null when either currency is unknown.
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  onDate?: Date | null,
): { amount: number; from: FxProvenance; to: FxProvenance } | null {
  const a = gbpRate(from, onDate);
  const b = gbpRate(to, onDate);
  if (!a || !b) return null;
  return { amount: (amount * a.rate) / b.rate, from: a, to: b };
}

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
  // UK gas bills state volume as m³ in several spellings. Without these the
  // record throws UnitError before it can reach the calorific conversion.
  "m³": { toCanonical: 1000, canonical: "litre" },
  "cubic metre": { toCanonical: 1000, canonical: "litre" },
  "cubic metres": { toCanonical: 1000, canonical: "litre" },
  "cubic meter": { toCanonical: 1000, canonical: "litre" },
  "cubic meters": { toCanonical: 1000, canonical: "litre" },

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

/// Which exchange rate a currency conversion actually used. Spend-based Scope 3
/// is not reproducible without it: the same record recalculated on another day
/// gives a different answer, and nothing on the row would say why.
export type FxProvenance = {
  currency: string;
  /// GBP per 1 unit of `currency`.
  rate: number;
  /// "dated" is the ECB rate for the activity date (the correct one).
  /// "live" is today's ECB rate, used when the dated rate could not be
  /// fetched. "fallback" is the hardcoded rate in this file.
  source: "dated" | "live" | "fallback";
  fetchedAt: Date | null;
  /// ECB business day of a "dated" rate.
  rateDate?: string;
};

export type NormalizedUnit = {
  amount: number;
  unit: string;
  /// Set only when the input unit was a currency.
  fx?: FxProvenance;
};

export function normalizeUnit(amount: number, unit: string, onDate?: Date | null): NormalizedUnit {
  const upper = unit.toUpperCase().trim();
  if (onDate && upper !== "GBP") {
    const dated = datedFx.get(isoDay(onDate));
    if (dated?.rates[upper] !== undefined) {
      const fx = gbpRate(upper, onDate)!;
      return { amount: amount * fx.rate, unit: "GBP", fx };
    }
  }
  // Then the latest live rate
  if (liveFxRates[upper] !== undefined) {
    const rate = liveFxRates[upper];
    return {
      amount: amount * rate,
      unit: "GBP",
      fx: {
        currency: upper,
        rate,
        source: "live",
        fetchedAt: liveFxFetchedAt ? new Date(liveFxFetchedAt) : null,
      },
    };
  }
  const entry = registry[unit.toLowerCase().trim()];
  if (!entry) throw new UnitError(`Unsupported unit: ${unit}`);
  return {
    amount: amount * entry.toCanonical,
    unit: entry.canonical,
    ...(entry.canonical === "GBP"
      ? {
          fx: {
            currency: upper,
            rate: entry.toCanonical,
            source: "fallback" as const,
            fetchedAt: null,
          },
        }
      : {}),
  };
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

/// Units that express a gas volume in cubic metres. Gas meters read in m³ but
/// natural gas emission factors are published per kWh, so a record in these
/// units needs the calorific conversion below rather than a volume conversion.
export const CUBIC_METRE_UNITS = new Set([
  "m3",
  "m³",
  "cubic metre",
  "cubic metres",
  "cubic meter",
  "cubic meters",
]);

/// Volume correction factor applied by UK gas suppliers to convert metered
/// volume to standard temperature and pressure. Fixed by Ofgem.
export const GAS_VOLUME_CORRECTION = 1.02264;

/// Gross calorific value of UK mains natural gas, MJ/m³. Suppliers state the
/// actual CV on each bill and it varies by region and season (roughly
/// 37.5–43.0), so pass the bill's own figure when the record carries it.
export const GAS_DEFAULT_CALORIFIC_VALUE_MJ_PER_M3 = 39.5;

/// Converts a metered gas volume in m³ to kWh using the UK billing formula:
///   kWh = m³ × volume correction × calorific value (MJ/m³) ÷ 3.6
/// At the default CV this is ~11.22 kWh per m³.
export function gasVolumeM3ToKwh(
  cubicMetres: number,
  calorificValueMjPerM3: number = GAS_DEFAULT_CALORIFIC_VALUE_MJ_PER_M3,
): number {
  return (cubicMetres * GAS_VOLUME_CORRECTION * calorificValueMjPerM3) / 3.6;
}

export class UnitError extends Error {}
