// Market-based Scope 2 contractual instruments (GHG Protocol Scope 2 Guidance,
// ch. 6-7). Market-based emissions come from the instruments an organisation
// holds, in this order of preference:
//   1. Energy attribute certificates and direct contracts: REGOs, Guarantees
//      of Origin, PPAs
//   2. Green tariffs from the supplier
//   3. The supplier's own emission rate (fuel mix disclosure)
//   4. The residual mix, for consumption no instrument covers
// Anything left after that falls back to the factor library, with a warning,
// because a location-based figure is not a true market-based one.
//
// Volume-limited instruments (coveredKwh set) are claimed once only: records
// are allocated in date order and each kWh of certificate can back one kWh of
// consumption. An instrument with no coveredKwh covers all consumption in its
// scope and window. Pure and deterministic, so a run split across chunks
// always reaches the same allocation.

import type { EnergyInstrumentType } from "@prisma/client";

export type InstrumentInput = {
  id: string;
  type: EnergyInstrumentType;
  facilityId: string | null;
  coveredKwh: number | null;
  factorKgPerKwh: number;
  validFrom: Date;
  validTo: Date;
  reference: string | null;
  supplierName: string | null;
};

export type MarketRecordInput = {
  id: string;
  facilityId: string | null;
  activityDate: Date;
  kwh: number;
};

export type AllocationPortion = {
  instrumentId: string;
  type: EnergyInstrumentType;
  kwh: number;
  factorKgPerKwh: number;
  label: string;
};

export type Allocation = {
  portions: AllocationPortion[];
  instrumentCo2eKg: number;
  coveredKwh: number;
  uncoveredKwh: number;
};

const TIER: Record<EnergyInstrumentType, number> = {
  rego: 1,
  guarantee_of_origin: 1,
  ppa: 1,
  green_tariff: 2,
  supplier_specific: 3,
  residual_mix: 4,
};

export const INSTRUMENT_LABELS: Record<EnergyInstrumentType, string> = {
  rego: "REGO",
  guarantee_of_origin: "Guarantee of Origin",
  ppa: "PPA",
  green_tariff: "Green tariff",
  supplier_specific: "Supplier emission rate",
  residual_mix: "Residual mix",
};

function describe(i: InstrumentInput): string {
  const parts = [INSTRUMENT_LABELS[i.type], i.supplierName, i.reference].filter(Boolean);
  return parts.join(" · ");
}

function applies(i: InstrumentInput, r: MarketRecordInput): boolean {
  if (r.activityDate < i.validFrom || r.activityDate > i.validTo) return false;
  return i.facilityId === null || i.facilityId === r.facilityId;
}

/** Instruments for one record in the order they are drawn down. */
function precedence(a: InstrumentInput, b: InstrumentInput): number {
  return (
    TIER[a.type] - TIER[b.type] ||
    // A facility's own contract before an organisation-wide one.
    Number(a.facilityId === null) - Number(b.facilityId === null) ||
    a.validFrom.getTime() - b.validFrom.getTime() ||
    a.id.localeCompare(b.id)
  );
}

export function allocateInstruments(
  records: MarketRecordInput[],
  instruments: InstrumentInput[],
): Map<string, Allocation> {
  const remaining = new Map(instruments.map((i) => [i.id, i.coveredKwh]));
  const ordered = [...instruments].sort(precedence);
  const result = new Map<string, Allocation>();

  const byDate = [...records].sort(
    (a, b) => a.activityDate.getTime() - b.activityDate.getTime() || a.id.localeCompare(b.id),
  );

  for (const record of byDate) {
    let left = Math.max(0, record.kwh);
    const portions: AllocationPortion[] = [];
    for (const instrument of ordered) {
      if (left <= 0) break;
      if (!applies(instrument, record)) continue;
      const available = remaining.get(instrument.id);
      const take = available == null ? left : Math.min(left, available);
      if (take <= 0) continue;
      if (available != null) remaining.set(instrument.id, available - take);
      left -= take;
      portions.push({
        instrumentId: instrument.id,
        type: instrument.type,
        kwh: take,
        factorKgPerKwh: instrument.factorKgPerKwh,
        label: describe(instrument),
      });
    }
    if (portions.length === 0) continue;
    const coveredKwh = portions.reduce((t, p) => t + p.kwh, 0);
    result.set(record.id, {
      portions,
      instrumentCo2eKg: portions.reduce((t, p) => t + p.kwh * p.factorKgPerKwh, 0),
      coveredKwh,
      uncoveredKwh: Math.max(0, record.kwh - coveredKwh),
    });
  }
  return result;
}

/** Human-readable formula for the instrument-backed share of a record. */
export function allocationFormula(a: Allocation): string {
  return a.portions
    .map((p) => `${p.kwh.toFixed(3)} kWh × ${p.factorKgPerKwh} kg/kWh (${p.label})`)
    .join(" + ");
}
