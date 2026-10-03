// Facility-level Scope 1 data for an Abu Dhabi MRV report, built from the
// organisation's own calculations. It follows the order of the Environment
// Agency's identifier and source stream sections so the operator can copy it
// across. It is not the Agency's workbook and does not reproduce its guidance:
// the operator files through the Agency's own template and portal, and
// completes the sections only they can (facility description, measurement
// based sources, methane, verification, quality assurance, mitigation).

import * as XLSX from "xlsx";
import { plusCode } from "@/lib/geo/address";


export type MrvCalcRow = {
  categoryName: string;
  fuelType: string | null;
  normalizedAmount: number;
  normalizedUnit: string;
  /** kg CO2e, as stored on the calculation. */
  totalKg: number;
  factorValue: number | null;
  factorSource: string;
  dataOrigin: string;
};

export type StreamRow = {
  stream: string;
  quantity: number;
  unit: string;
  tonnesCo2e: number;
  /** The factor when every record used the same one, otherwise null. */
  factorValue: number | null;
  factorSource: string;
  records: number;
  dataOrigin: string;
};

/** One row per category, fuel and unit; the tonnes and quantities are sums, never averages. */
export function aggregateStreams(rows: MrvCalcRow[]): StreamRow[] {
  const map = new Map<string, StreamRow & { factors: Set<string>; origins: Set<string>; sources: Set<string> }>();
  for (const r of rows) {
    const stream = r.fuelType ? `${r.categoryName}: ${r.fuelType}` : r.categoryName;
    const key = `${stream}|${r.normalizedUnit}`;
    const row = map.get(key) ?? {
      stream, quantity: 0, unit: r.normalizedUnit, tonnesCo2e: 0, factorValue: null, factorSource: "", records: 0, dataOrigin: "",
      factors: new Set<string>(), origins: new Set<string>(), sources: new Set<string>(),
    };
    row.quantity += r.normalizedAmount;
    row.tonnesCo2e += r.totalKg / 1000;
    row.records += 1;
    if (r.factorValue != null) row.factors.add(String(r.factorValue));
    row.origins.add(r.dataOrigin);
    row.sources.add(r.factorSource);
    map.set(key, row);
  }
  return [...map.values()]
    .map((r) => ({
      stream: r.stream,
      quantity: r.quantity,
      unit: r.unit,
      tonnesCo2e: r.tonnesCo2e,
      factorValue: r.factors.size === 1 ? Number([...r.factors][0]) : null,
      factorSource: [...r.sources].sort().join("; "),
      records: r.records,
      dataOrigin: [...r.origins].sort().join("; "),
    }))
    .sort((a, b) => b.tonnesCo2e - a.tonnesCo2e);
}

export type MrvFacilityInput = {
  year: number;
  companyName: string;
  parentName: string | null;
  facilityName: string;
  economicLicenceNumber: string | null;
  environmentalPermitNumber: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  streams: StreamRow[];
  generatedOn: string;
};

export function buildMrvWorkbook(f: MrvFacilityInput): Buffer {
  const total = f.streams.reduce((s, r) => s + r.tonnesCo2e, 0);
  const wb = XLSX.utils.book_new();
  const add = (name: string, aoa: (string | number | null)[][], widths?: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (widths) ws["!cols"] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add("Read me", [
    [`Facility Scope 1 data for calendar year ${f.year}`],
    [`Prepared by MetricOra on ${f.generatedOn} from the organisation's own calculated records.`],
    ["This is not the Environment Agency's reporting template. Copy the figures into the Agency's current template and submit through its portal."],
    ["Only Scope 1 emissions at this facility are included. Sections only the operator can complete are not filled: facility description, measurement based sources, methane, verification and data gaps, management and quality assurance, mitigation measures."],
  ], [140]);
  add("Identifiers", [
    ["Entity or company name", f.companyName],
    ["Group or parent entity", f.parentName ?? ""],
    ["Facility name", f.facilityName],
    ["Economic licence number", f.economicLicenceNumber ?? ""],
    ["Environmental permit number", f.environmentalPermitNumber ?? ""],
    ["Facility address", f.address ?? ""],
    ["Coordinates of the main entrance", f.latitude != null && f.longitude != null ? `${f.latitude}, ${f.longitude}` : ""],
    ["Plus Code of the same position", f.latitude != null && f.longitude != null ? plusCode(f.latitude, f.longitude) : ""],
  ], [36, 60]);
  add("Source streams", [
    ["Source stream", "Quantity", "Unit", "Emission factor (kg CO2e per unit)", "Factor source", "tCO2e", "Records", "Data origin"],
    ...f.streams.map((r) => [r.stream, r.quantity, r.unit, r.factorValue, r.factorSource, r.tonnesCo2e, r.records, r.dataOrigin]),
    ["Total Scope 1", null, null, null, null, total, f.streams.reduce((s, r) => s + r.records, 0), ""],
  ], [44, 14, 12, 22, 40, 12, 10, 24]);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
