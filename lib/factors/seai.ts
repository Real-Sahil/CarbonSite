// SEAI (Sustainable Energy Authority of Ireland) conversion and emission
// factors, 2025 values, into the "SEAI" library, version "2025".
//
// Source workbook: SEAI-conversion-and-emission-factors.xlsx. The workbook
// states no licence; SEAI is named as the source on every factor and in the
// library record, and docs/THIRD_PARTY_SOURCES.md records that no licence was
// found. Emission factors are CO2 only (CH4 and N2O are not given), so a CO2e
// from this library is CO2. Fuels are on a net calorific value basis unless
// the row says GCV. Sustainable biomass, bioethanol, HVO and biopropane are
// treated by SEAI as zero net CO2; they load as zero, as SEAI states.
//
// Electricity: the yearly "Electricity consumption" factor (CO2 arising in
// Ireland per unit of electricity available for final consumption) from the
// GHG_elec time series, each year effective for that calendar year, the first
// open to the past and the last open to the future.

import { assertUnique, round, slug, type NationalFactor } from "./national-load";

type Row = unknown[];
export type SeaiSheets = Record<string, Row[]>;

const cell = (r: Row, i: number) => (r[i] == null ? "" : String(r[i]).replace(/\s+/g, " ").trim());
const num = (r: Row, i: number): number | null => (typeof r[i] === "number" && Number.isFinite(r[i] as number) ? (r[i] as number) : null);

const SRC = "Sustainable Energy Authority of Ireland (SEAI), Conversion and emission factors (SEAI statistics), 2025 values";

const ALIAS: [RegExp, string][] = [
  [/^Diesel \/ gasoil/i, "diesel, gas oil, red diesel"],
  [/^Road diesel/i, "diesel, road diesel, DERV"],
  [/^Gasoline \/ petrol|^Road petrol/i, "petrol, gasoline"],
  [/^LPG/i, "LPG, propane, butane"],
  [/^Kerosene/i, "kerosene, heating oil"],
  [/^Jet Kerosene/i, "jet fuel, aviation turbine fuel"],
  [/^Residual fuel oil/i, "heavy fuel oil, fuel oil"],
  [/^Natural gas/i, "natural gas, mains gas"],
  [/^Bituminous coal/i, "coal, house coal"],
  [/^Sod peat/i, "peat, turf"],
  [/^Biodiesel HVO/i, "HVO, renewable diesel"],
  [/^Biodiesel ME/i, "biodiesel, FAME"],
  [/^Wood/i, "wood, biomass"],
];
const aka = (n: string) => ALIAS.find(([re]) => re.test(n))?.[1];

type Item = { name: string; section: "liquid" | "solid" | "gas"; kgPerKg: number | null; kgPerLitre: number | null; kgPerM3: number | null; gPerKwh: number | null; zeroNet: boolean; note: string };

/** Fuel rows of the "Conversion and emission factors" sheet. */
export function fuelItems(rows: Row[]): Item[] {
  const out: Item[] = [];
  let section: Item["section"] | null = null;
  for (const r of rows) {
    const first = cell(r, 0);
    if (/^(Liquid|Solid|Gas)$/i.test(first) && /Energy content/i.test(cell(r, 1))) {
      section = first.toLowerCase() as Item["section"];
      continue;
    }
    if (/^Electricity$/i.test(first)) section = null;
    if (!section || !first) continue;
    const energy = num(r, 1) ?? num(r, 2);
    if (energy == null) continue; // a group heading
    const dash = (i: number) => cell(r, i) === "-";
    const kgPerKg = section === "gas" ? null : num(r, 6);
    const kgPerLitre = section === "liquid" ? num(r, 7) : null;
    const kgPerM3 = section === "gas" ? num(r, 6) : null;
    const gPerKwh = num(r, 4);
    const zeroNet = dash(4) && dash(5);
    out.push({ name: first, section, kgPerKg, kgPerLitre, kgPerM3, gPerKwh, zeroNet, note: cell(r, 11) });
  }
  return out;
}

export function fuelFactors(rows: Row[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const it of fuelItems(rows)) {
    const alias = aka(it.name);
    const base = `${it.name}${alias ? ` (${alias})` : ""}`;
    const tail = `${it.note ? `${it.note}. ` : ""}${it.zeroNet ? "SEAI treats the net CO2 of this sustainable biofuel as zero. " : ""}CO2 only (CH4 and N2O are not given by SEAI). ${SRC}.`;
    const slugName = slug(it.name);
    const mk = (cat: "s1-stationary" | "s1-mobile", unit: string, value: number, kind: string, def: boolean, extra = "") =>
      out.push({
        externalId: `seai-2025-${cat === "s1-stationary" ? "stat" : "mobile"}-${slugName}-${kind}`,
        scope: 1,
        categoryCode: cat,
        activityType: def ? (cat === "s1-stationary" ? "stationary_combustion" : "mobile_combustion") : `${cat === "s1-stationary" ? "stationary" : "mobile"}_combustion_${slugName}`,
        country: "IE",
        unit,
        co2: round(value),
        co2e: round(value),
        notes: `${base}. Scope 1, kg CO2 per ${unit === "litre" ? "litre" : unit}. ${extra}${tail}`,
      });
    const zero = (v: number | null) => (v == null && it.zeroNet ? 0 : v);
    if (it.section === "liquid") {
      const l = zero(it.kgPerLitre);
      const k = zero(it.kgPerKg);
      for (const cat of ["s1-stationary", "s1-mobile"] as const) {
        if (l != null) mk(cat, "litre", l, "litre", cat === "s1-stationary" ? /^Diesel \/ gasoil/i.test(it.name) : /^Road diesel/i.test(it.name));
        if (k != null && cat === "s1-stationary") mk(cat, "kg", k, "kg", false);
      }
    } else if (it.section === "solid") {
      const k = zero(it.kgPerKg);
      if (k != null) mk("s1-stationary", "kg", k, "kg", false);
    } else {
      const gcv = /\(GCV\)/i.test(it.name);
      const ncv = /\(NCV\)/i.test(it.name);
      if (gcv && it.kgPerM3 != null) mk("s1-stationary", "m3", it.kgPerM3, "m3", true, "Per cubic metre at standard conditions. ");
      if (it.gPerKwh != null) mk("s1-stationary", ncv ? "kWh_ncv" : "kWh", it.gPerKwh / 1000, ncv ? "kwh-ncv" : "kwh", gcv, ncv ? "kWh on a net calorific value basis. " : "kWh on a gross calorific value basis, as on gas bills. ");
    }
  }
  return out;
}

/** GHG_elec: year, consumption g CO2/kWh, gross supply g CO2/kWh. */
export function electricityFactors(rows: Row[], firstYear = 2015): NationalFactor[] {
  const data = rows.filter((r) => num(r, 0) != null && num(r, 1) != null && Number(r[0]) >= firstYear).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (!data.length) throw new Error("SEAI GHG_elec: no years found");
  const last = Number(data[data.length - 1][0]);
  return data.map((r, i) => {
    const y = Number(r[0]);
    return {
      externalId: `seai-2025-elec-consumption-${y}`,
      scope: 2,
      categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location",
      country: "IE",
      unit: "kWh",
      co2: round(Number(r[1]) / 1000),
      co2e: round(Number(r[1]) / 1000),
      effectiveStart: i === 0 ? null : `${y}-01-01`,
      effectiveEnd: y === last ? null : `${y}-12-31`,
      notes: `Ireland, ${y}: electricity consumption emission factor, kg CO2 per kWh (CO2 arising in Ireland per unit of electricity available for final consumption; imports are not included). Location-based Scope 2. CO2 only. ${y === last ? "Latest year, applied to later periods until SEAI publishes the next. " : ""}${SRC}, GHG_elec time series.`,
    };
  });
}

export function buildSeaiFactors(s: SeaiSheets): NationalFactor[] {
  const need = (n: string) => {
    const k = Object.keys(s).find((x) => x.trim() === n);
    if (!k) throw new Error(`SEAI sheet not found: ${n}`);
    return s[k];
  };
  const all = [...fuelFactors(need("Conversion and emission factors")), ...electricityFactors(need("GHG_elec"))];
  assertUnique(all);
  return all;
}
