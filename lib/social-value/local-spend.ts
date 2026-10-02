/**
 * Local spend: how much of a project's supplier spend went to businesses near
 * the site, the figure most social value models and tender questions ask for
 * ("% of spend within 20 miles", "% with SMEs"). Pure maths only; the loader
 * and geocoder live elsewhere so this stays testable.
 */

export const DEFAULT_RADIUS_MILES = 20;
export const MAX_RADIUS_MILES = 250;

const EARTH_RADIUS_MILES = 3958.8;

export type LatLng = { latitude: number; longitude: number };

/** Great-circle distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Records name suppliers freehand, so match on a normalised key. */
export function supplierKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(limited|ltd|plc|llp|llc|inc|co|company|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** UK postcode, spaced and upper-cased, or null when it is not one. */
export function normalisePostcode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export type SpendLine = { supplierName: string | null; amount: number; currency: string | null };

export type SupplierLocation = {
  key: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  sme: boolean | null;
};

export type LocalSpendSummary = {
  radiusMiles: number;
  /** Spend in GBP that could be placed (supplier known, located, and in GBP). */
  totalGbp: number;
  localGbp: number;
  smeGbp: number;
  localSmeGbp: number;
  /** Shares of `totalGbp`, 0 to 100; null when there is no placed spend. */
  localPct: number | null;
  smePct: number | null;
  /** Spend that could not be placed, kept apart so the share is never inflated. */
  unplaced: { noSupplierGbp: number; unlocatedGbp: number; notGbpLines: number };
  /** Suppliers named in the records that have no postcode yet, largest spend first. */
  missingLocations: { name: string; spendGbp: number }[];
  topLocal: { name: string; spendGbp: number; miles: number }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summariseLocalSpend(
  lines: SpendLine[],
  suppliers: SupplierLocation[],
  site: LatLng,
  radiusMiles: number = DEFAULT_RADIUS_MILES,
): LocalSpendSummary {
  const byKey = new Map(suppliers.map((s) => [s.key, s]));
  let totalGbp = 0;
  let localGbp = 0;
  let smeGbp = 0;
  let localSmeGbp = 0;
  let noSupplierGbp = 0;
  let unlocatedGbp = 0;
  let notGbpLines = 0;
  const missing = new Map<string, { name: string; spendGbp: number }>();
  const local = new Map<string, { name: string; spendGbp: number; miles: number }>();

  for (const line of lines) {
    if (!(line.amount > 0)) continue;
    if (line.currency && line.currency.toUpperCase() !== "GBP") {
      notGbpLines += 1;
      continue;
    }
    const name = line.supplierName?.trim();
    if (!name) {
      noSupplierGbp += line.amount;
      continue;
    }
    const key = supplierKey(name);
    const supplier = byKey.get(key);
    if (!supplier || supplier.latitude == null || supplier.longitude == null) {
      unlocatedGbp += line.amount;
      const seen = missing.get(key) ?? { name, spendGbp: 0 };
      seen.spendGbp += line.amount;
      missing.set(key, seen);
      continue;
    }
    const miles = distanceMiles(site, { latitude: supplier.latitude, longitude: supplier.longitude });
    const isLocal = miles <= radiusMiles;
    totalGbp += line.amount;
    if (supplier.sme) smeGbp += line.amount;
    if (isLocal) {
      localGbp += line.amount;
      if (supplier.sme) localSmeGbp += line.amount;
      const seen = local.get(key) ?? { name: supplier.name, spendGbp: 0, miles };
      seen.spendGbp += line.amount;
      local.set(key, seen);
    }
  }

  const pct = (part: number) => (totalGbp > 0 ? Math.round((part / totalGbp) * 1000) / 10 : null);
  return {
    radiusMiles,
    totalGbp: round2(totalGbp),
    localGbp: round2(localGbp),
    smeGbp: round2(smeGbp),
    localSmeGbp: round2(localSmeGbp),
    localPct: pct(localGbp),
    smePct: pct(smeGbp),
    unplaced: { noSupplierGbp: round2(noSupplierGbp), unlocatedGbp: round2(unlocatedGbp), notGbpLines },
    missingLocations: [...missing.values()]
      .map((m) => ({ ...m, spendGbp: round2(m.spendGbp) }))
      .sort((a, b) => b.spendGbp - a.spendGbp)
      .slice(0, 25),
    topLocal: [...local.values()]
      .map((m) => ({ ...m, spendGbp: round2(m.spendGbp), miles: Math.round(m.miles * 10) / 10 }))
      .sort((a, b) => b.spendGbp - a.spendGbp)
      .slice(0, 10),
  };
}
