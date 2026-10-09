/**
 * The KPIs a report can show. Each is computed from one aggregate of waste
 * records (plus a value and floor area when known), so the same number comes
 * out for the company, a business unit and a project. A KPI whose denominator
 * is missing gives null and the table says why, never zero.
 */
import { wasteHierarchyOf } from "@/lib/waste/hierarchy";

export type KpiAgg = {
  tonnes: number;
  recycledT: number;
  recoveredT: number;
  landfillT: number;
  hazardousT: number;
  co2eT: number;
  records: number;
  /** Revenue or contract value in the reporting currency, when known. */
  value: number | null;
  floorM2: number | null;
};

export const emptyAgg = (): KpiAgg => ({ tonnes: 0, recycledT: 0, recoveredT: 0, landfillT: 0, hazardousT: 0, co2eT: 0, records: 0, value: null, floorM2: null });

export function addRecord(a: KpiAgg, r: { tonnes: number; route: string; hazardous: boolean; co2eT: number | null }) {
  a.tonnes += r.tonnes;
  const h = wasteHierarchyOf(r.route);
  if (h === "recycle") a.recycledT += r.tonnes;
  else if (h === "recovery") a.recoveredT += r.tonnes;
  else a.landfillT += r.tonnes;
  if (r.hazardous) a.hazardousT += r.tonnes;
  a.co2eT += r.co2eT ?? 0;
  a.records += 1;
}

export type KpiDef = {
  /** Short, because the chosen ids are kept in a page address a saved view stores (64 characters). */
  id: string;
  label: string;
  unit: string;
  topic: "Waste";
  decimals: number;
  /** Shown when the figure is blank, so the reader knows what to add. */
  needs?: string;
  compute: (a: KpiAgg) => number | null;
};

const share = (part: number, a: KpiAgg) => (a.tonnes > 0 ? (part / a.tonnes) * 100 : null);

export const KPIS: readonly KpiDef[] = [
  { id: "wt", label: "Waste generated", unit: "t", topic: "Waste", decimals: 1, compute: (a) => (a.records ? a.tonnes : null) },
  { id: "dv", label: "Diverted from landfill", unit: "%", topic: "Waste", decimals: 0, compute: (a) => share(a.recycledT + a.recoveredT, a) },
  { id: "rc", label: "Recycled", unit: "%", topic: "Waste", decimals: 0, compute: (a) => share(a.recycledT, a) },
  { id: "lf", label: "Sent to landfill", unit: "t", topic: "Waste", decimals: 1, compute: (a) => (a.records ? a.landfillT : null) },
  { id: "hz", label: "Hazardous waste", unit: "t", topic: "Waste", decimals: 1, compute: (a) => (a.records ? a.hazardousT : null) },
  { id: "pk", label: "Waste per 100k of value", unit: "t", topic: "Waste", decimals: 2, needs: "a contract value (project) or revenue (company)", compute: (a) => (a.value && a.value > 0 ? a.tonnes / (a.value / 100_000) : null) },
  { id: "pm", label: "Waste per 100 m²", unit: "t", topic: "Waste", decimals: 2, needs: "a floor area on the project's carbon budget", compute: (a) => (a.floorM2 && a.floorM2 > 0 ? a.tonnes / (a.floorM2 / 100) : null) },
  { id: "co", label: "Waste carbon", unit: "tCO₂e", topic: "Waste", decimals: 2, compute: (a) => (a.records ? a.co2eT : null) },
  { id: "nr", label: "Waste records", unit: "", topic: "Waste", decimals: 0, compute: (a) => (a.records ? a.records : null) },
];

export const DEFAULT_KPIS = ["wt", "dv", "pk", "pm", "co"];
const known = new Set(KPIS.map((k) => k.id));

/** The chosen ids from a page address: known ones only, in catalogue order, never more than fit a saved view. */
export function parseKpiIds(raw: string | undefined | null): string[] {
  const asked = new Set((raw ?? "").split(",").map((s) => s.trim()).filter((s) => known.has(s)));
  const chosen = KPIS.filter((k) => asked.has(k.id)).map((k) => k.id);
  return chosen.length ? chosen : DEFAULT_KPIS;
}

export function sumAggs(list: KpiAgg[]): KpiAgg {
  const out = emptyAgg();
  for (const a of list) {
    out.tonnes += a.tonnes; out.recycledT += a.recycledT; out.recoveredT += a.recoveredT; out.landfillT += a.landfillT;
    out.hazardousT += a.hazardousT; out.co2eT += a.co2eT; out.records += a.records;
  }
  return out;
}
