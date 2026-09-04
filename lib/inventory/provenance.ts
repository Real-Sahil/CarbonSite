// Data provenance tiers.
//
// Every activity figure records how it was obtained. Two things depend on it:
// assurance providers sample by tier and test the weakest first, and both
// ESRS E1 and CDP require the split between primary and secondary data to be
// disclosed.

import type { DataOrigin } from "@prisma/client";

/** Strongest to weakest. Index doubles as the sort order in the UI. */
export const DATA_ORIGIN_ORDER: DataOrigin[] = [
  "metered",
  "invoiced",
  "supplier_specific",
  "calculated",
  "estimated",
  "proxy",
  "extrapolated",
];

interface OriginMeta {
  label: string;
  description: string;
  /** Primary data is observed at source. Secondary is modelled or averaged. */
  isPrimary: boolean;
  /** 1 (strongest) to 5 (weakest), matching the pedigree reliability scale. */
  reliabilityScore: number;
  /** Whether a written justification is required alongside the figure. */
  requiresNote: boolean;
}

export const DATA_ORIGIN_META: Record<DataOrigin, OriginMeta> = {
  metered: {
    label: "Metered",
    description: "Read from a physical or smart meter at the point of consumption.",
    isPrimary: true,
    reliabilityScore: 1,
    requiresNote: false,
  },
  invoiced: {
    label: "Invoiced",
    description: "Quantity taken from a supplier invoice, delivery note or waste transfer note.",
    isPrimary: true,
    reliabilityScore: 1,
    requiresNote: false,
  },
  supplier_specific: {
    label: "Supplier specific",
    description: "Figure supplied by the vendor from their own inventory, EPD or verified disclosure.",
    isPrimary: true,
    reliabilityScore: 2,
    requiresNote: false,
  },
  calculated: {
    label: "Calculated",
    description: "Derived from other measured values by a documented calculation.",
    isPrimary: true,
    reliabilityScore: 2,
    requiresNote: false,
  },
  estimated: {
    label: "Estimated",
    description: "Estimated from an average, a model or engineering judgement.",
    isPrimary: false,
    reliabilityScore: 3,
    requiresNote: false,
  },
  proxy: {
    label: "Proxy",
    description: "A stand-in taken from a comparable site, period or activity.",
    isPrimary: false,
    reliabilityScore: 4,
    requiresNote: true,
  },
  extrapolated: {
    label: "Extrapolated",
    description: "Scaled up from a partial period or a partial population.",
    isPrimary: false,
    reliabilityScore: 5,
    requiresNote: true,
  },
};

export function isPrimaryData(origin: DataOrigin): boolean {
  return DATA_ORIGIN_META[origin].isPrimary;
}

export function requiresJustification(origin: DataOrigin): boolean {
  return DATA_ORIGIN_META[origin].requiresNote;
}

/**
 * Parses a free-text provenance value from a CSV import or API payload.
 * Accepts the enum values plus the phrasings people actually type.
 * Returns null when nothing sensible can be read, so the caller can decide
 * whether to fall back to a default or raise a validation error.
 */
export function parseDataOrigin(input: unknown): DataOrigin | null {
  if (typeof input !== "string") return null;
  const key = input.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return null;

  if ((DATA_ORIGIN_ORDER as string[]).includes(key)) return key as DataOrigin;

  const aliases: Record<string, DataOrigin> = {
    meter: "metered",
    meter_read: "metered",
    meter_reading: "metered",
    measured: "metered",
    actual: "metered",
    invoice: "invoiced",
    bill: "invoiced",
    billed: "invoiced",
    delivery_note: "invoiced",
    supplier: "supplier_specific",
    primary: "supplier_specific",
    epd: "supplier_specific",
    calc: "calculated",
    derived: "calculated",
    estimate: "estimated",
    modelled: "estimated",
    modeled: "estimated",
    average: "estimated",
    secondary: "estimated",
    substitute: "proxy",
    proxy_data: "proxy",
    extrapolation: "extrapolated",
    scaled: "extrapolated",
    prorated: "extrapolated",
    pro_rated: "extrapolated",
  };

  return aliases[key] ?? null;
}

export interface ProvenanceBreakdownRow {
  origin: DataOrigin;
  label: string;
  isPrimary: boolean;
  recordCount: number;
  totalCo2e: number;
  /** Share of total emissions, 0-100. */
  percentOfEmissions: number;
}

export interface ProvenanceBreakdown {
  rows: ProvenanceBreakdownRow[];
  totalCo2e: number;
  totalRecords: number;
  /** Share of emissions from primary data, 0-100. The CDP-scored figure. */
  primaryDataPercent: number;
  /** Share of emissions carrying a weak tier that assurance will test first. */
  lowConfidencePercent: number;
}

/**
 * Aggregates per-record provenance into the disclosure figures.
 * Emissions-weighted rather than record-weighted: one metered gas supply can
 * outweigh a thousand estimated stationery lines, and it is the emissions
 * split that frameworks ask for.
 */
export function summariseProvenance(
  records: Array<{ dataOrigin: DataOrigin; totalCo2e: number }>,
): ProvenanceBreakdown {
  const byOrigin = new Map<DataOrigin, { count: number; co2e: number }>();
  let totalCo2e = 0;

  for (const record of records) {
    const co2e = Number.isFinite(record.totalCo2e) ? record.totalCo2e : 0;
    const bucket = byOrigin.get(record.dataOrigin) ?? { count: 0, co2e: 0 };
    bucket.count += 1;
    bucket.co2e += co2e;
    byOrigin.set(record.dataOrigin, bucket);
    totalCo2e += co2e;
  }

  const rows: ProvenanceBreakdownRow[] = DATA_ORIGIN_ORDER.filter((origin) =>
    byOrigin.has(origin),
  ).map((origin) => {
    const bucket = byOrigin.get(origin)!;
    return {
      origin,
      label: DATA_ORIGIN_META[origin].label,
      isPrimary: DATA_ORIGIN_META[origin].isPrimary,
      recordCount: bucket.count,
      totalCo2e: bucket.co2e,
      percentOfEmissions: totalCo2e > 0 ? (bucket.co2e / totalCo2e) * 100 : 0,
    };
  });

  const primaryCo2e = rows
    .filter((r) => r.isPrimary)
    .reduce((sum, r) => sum + r.totalCo2e, 0);

  const lowConfidenceCo2e = rows
    .filter((r) => DATA_ORIGIN_META[r.origin].reliabilityScore >= 4)
    .reduce((sum, r) => sum + r.totalCo2e, 0);

  return {
    rows,
    totalCo2e,
    totalRecords: records.length,
    primaryDataPercent: totalCo2e > 0 ? (primaryCo2e / totalCo2e) * 100 : 0,
    lowConfidencePercent: totalCo2e > 0 ? (lowConfidenceCo2e / totalCo2e) * 100 : 0,
  };
}
