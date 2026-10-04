// Australian National Greenhouse Accounts (NGA) Factors 2025 (DCCEEW) into
// emission factors for the "NGA Factors" 2025 library.
//
// Source workbook: national-greenhouse-account-factors-2025.xlsx, Creative
// Commons Attribution (Commonwealth of Australia). Rows come from:
//   Table 1, 2        electricity by state and grid (Scope 2 and 3), residual mix
//   Energy - Scope 1  flat sheet of per-unit fuel factors (CO2-e per t, kL or m3)
//   Energy - Scope 3  upstream fuel factors, same layout
//   Table 15, 16      landfill factors by waste type and broad stream
//   Table 11          refrigerant GWPs (AR5)
// Gases are combined by NGA at AR5 GWPs; the library keeps its combined figure.
// A state's electricity row is picked only when the record or its facility
// names the state (lib/calculation/regional-grid.ts); otherwise the national row.

import { assertUnique, round, slug, type NationalFactor } from "./national-load";

type Row = unknown[];
export type NgaSheets = Record<string, Row[]>;

const cell = (r: Row, i: number) => (r[i] == null ? "" : String(r[i]).replace(/\s+/g, " ").trim());
const num = (r: Row, i: number): number | null => (typeof r[i] === "number" && Number.isFinite(r[i] as number) ? (r[i] as number) : null);

const SRC = "National Greenhouse Accounts Factors 2025, Department of Climate Change, Energy, the Environment and Water (DCCEEW), Commonwealth of Australia, Creative Commons Attribution";

/** Grid code for a Table 1 row label (the label may continue on the next sheet row). */
const GRID_BY_LABEL: [RegExp, string, string][] = [
  [/^New South Wales and Australian Capital Territory/i, "nsw", "New South Wales and Australian Capital Territory"],
  [/^Victoria/i, "vic", "Victoria"],
  [/^Queensland/i, "qld", "Queensland"],
  [/^South Australia/i, "sa", "South Australia"],
  [/South West Interconnected System|SWIS/i, "wa", "Western Australia (South West Interconnected System, SWIS)"],
  [/North Western Interconnected System|NWIS/i, "nwis", "Western Australia (North Western Interconnected System, NWIS)"],
  [/^Tasmania/i, "tas", "Tasmania"],
  [/Darwin Katherine|DKIS/i, "nt", "Northern Territory (Darwin Katherine Interconnected System, DKIS)"],
];

type Grid = { code: string | "national"; region: string; scope2: number; scope3: number };

/** Table 1 rows: a label that ends with a dash continues on the following row. */
export function gridRows(rows: Row[]): Grid[] {
  const out: Grid[] = [];
  for (let i = 0; i < rows.length; i++) {
    const s2 = num(rows[i], 1);
    const s3 = num(rows[i], 2);
    if (s2 == null || s3 == null) continue;
    let label = cell(rows[i], 0);
    if (/-$/.test(label) && i + 1 < rows.length && num(rows[i + 1], 1) == null) label = `${label} ${cell(rows[i + 1], 0)}`;
    if (/^National/i.test(label)) {
      out.push({ code: "national", region: "Australia", scope2: s2, scope3: s3 });
      continue;
    }
    const hit = GRID_BY_LABEL.find(([re]) => re.test(label));
    if (!hit) throw new Error(`NGA Table 1: unknown grid "${label}"`);
    out.push({ code: hit[1], region: hit[2], scope2: s2, scope3: s3 });
  }
  if (!out.some((g) => g.code === "national")) throw new Error("NGA Table 1: national row not found");
  return out;
}

export function electricityFactors(table1: Row[], table2: Row[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const g of gridRows(table1)) {
    const national = g.code === "national";
    out.push({
      externalId: `nga-2025-elec-s2-${g.code}`,
      scope: 2,
      categoryCode: "s2-electricity-lb",
      activityType: national ? "purchased_electricity_location" : `grid_au_${g.code}`,
      country: "AU",
      region: national ? null : g.region,
      unit: "kWh",
      co2e: g.scope2,
      notes: `${national ? "Australia, national average grid" : g.region}: location-based Scope 2 emission factor for purchased electricity, kg CO2-e per kWh. NGA Factors 2025, Table 1. ${SRC}.`,
    });
    out.push({
      externalId: `nga-2025-elec-s3-${g.code}`,
      scope: 3,
      categoryCode: "s3-fuel-energy",
      activityType: national ? "fuel_energy_activities" : `grid_au_${g.code}_upstream`,
      country: "AU",
      region: national ? null : g.region,
      unit: "kWh",
      co2e: g.scope3,
      notes: `${national ? "Australia, national" : g.region}: Scope 3 emission factor for the consumption and losses of purchased electricity (upstream and transmission and distribution), kg CO2-e per kWh. NGA Factors 2025, Table 1. ${SRC}.`,
    });
  }
  const mb = table2.find((r) => /^National/i.test(cell(r, 0)) && num(r, 1) != null);
  if (!mb) throw new Error("NGA Table 2: residual mix row not found");
  out.push({
    externalId: "nga-2025-elec-residual-mix-national",
    scope: 2,
    categoryCode: "s2-electricity-mb",
    activityType: "purchased_electricity_market",
    country: "AU",
    unit: "kWh",
    co2e: num(mb, 1)!,
    notes: `Australia, residual mix factor for the market-based method, kg CO2-e per kWh (Scope 2). NGA Factors 2025, Table 2. ${SRC}.`,
  });
  return out;
}

const ALIAS: [RegExp, string][] = [
  [/^Diesel oil/i, "diesel, gas oil"],
  [/^Automotive gasoline|^Gasoline/i, "petrol, gasoline"],
  [/^Liquefied petroleum gas/i, "LPG, autogas"],
  [/^Heating oil/i, "heating oil, light fuel oil"],
  [/^Natural gas distributed|^Natural Gas/i, "natural gas, mains gas"],
  [/^Aviation turbine fuel|^Kerosene for use as fuel in an aircraft/i, "jet fuel, jet A1, aviation turbine fuel"],
  [/^Bituminous coal/i, "black coal"],
  [/^Compressed natural gas/i, "CNG, natural gas"],
  [/^Liquefied natural gas/i, "LNG, natural gas"],
  [/^Biodiesel/i, "biodiesel, B100"],
  [/^Renewable diesel/i, "renewable diesel, HVO"],
];
const aka = (name: string) => ALIAS.find(([re]) => re.test(name))?.[1];

const MOBILE = /(Cars and light commercial vehicles|Light duty vehicles|Heavy duty vehicles|Aviation$|for use as fuel in an aircraft)/i;

/** Names whose "GJ/t" unit in the flat sheet is a per-kL value (Table 8 gives them in GJ/kL). */
const UNIT_FIXED = /^(Renewable aviation kerosene|Renewable diesel)$/i;

function perUnit(value: number, unit: string, name: string): { unit: string; value: number; fixed: boolean } {
  const u = unit.toLowerCase();
  if (u.includes("/t")) return UNIT_FIXED.test(name) ? { unit: "litre", value: value / 1000, fixed: true } : { unit: "kg", value: value / 1000, fixed: false };
  if (u.includes("/kl")) return { unit: "litre", value: value / 1000, fixed: false };
  if (u.includes("/m3")) return { unit: "m3", value: value, fixed: false };
  throw new Error(`NGA: unit "${unit}" for ${name}`);
}

function flatRows(rows: Row[]): { type: string; name: string; combined: number; content: number; contentUnit: string; perUnit: number; unit: string }[] {
  const out = [];
  for (const r of rows) {
    const type = cell(r, 0);
    const name = cell(r, 1);
    const unit = cell(r, 9);
    const value = num(r, 8);
    if (!/(Solid|Gaseous|Liquid) fuels/i.test(type) || !name || value == null || !unit) continue;
    out.push({ type, name, combined: num(r, 5) ?? 0, content: num(r, 6) ?? 0, contentUnit: cell(r, 7), perUnit: value, unit });
  }
  return out;
}

/** Scope 1 fuel combustion from the flat "Energy - Scope 1" sheet. */
export function fuelFactors(rows: Row[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  const seen = new Map<string, number>();
  for (const f of flatRows(rows)) {
    const n = (seen.get(f.name) ?? 0) + 1;
    seen.set(f.name, n);
    const mobile = MOBILE.test(f.name) || (n > 1 && /Renewable aviation kerosene/i.test(f.name));
    const conv = perUnit(f.perUnit, f.unit, f.name);
    const base = f.name.replace(/-(Cars and light commercial vehicles|Light duty vehicles|Heavy duty vehicles|Aviation)$/i, (m) => ` (${m.slice(1).toLowerCase()})`);
    const isDefault =
      (!mobile && /^(Natural gas distributed in a pipeline|Diesel oil)$/.test(f.name)) ||
      (mobile && f.name === "Diesel oil-Cars and light commercial vehicles");
    const alias = aka(f.name);
    const id = `nga-2025-${mobile ? "mobile" : "stat"}-${slug(f.name)}-${conv.unit === "litre" ? "litre" : conv.unit}`;
    out.push({
      externalId: id,
      scope: 1,
      categoryCode: mobile ? "s1-mobile" : "s1-stationary",
      activityType: isDefault ? (mobile ? "mobile_combustion" : "stationary_combustion") : `${mobile ? "mobile" : "stationary"}_combustion_${slug(f.name)}`,
      country: "AU",
      unit: conv.unit,
      co2e: round(conv.value),
      notes: `${base}${alias ? ` (${alias})` : ""}. Scope 1 combined emission factor, kg CO2-e per ${conv.unit === "litre" ? "litre" : conv.unit} (CO2, CH4 and N2O at AR5 GWPs; energy content ${f.content} ${f.contentUnit}). NGA Factors 2025, "Energy - Scope 1" sheet.${conv.fixed ? " The sheet gives this row per tonne; its energy content is per kilolitre (Table 8), so it is loaded per litre." : ""} ${SRC}.`,
    });
    // Natural gas bills are in kWh: gross energy content, 3.6 MJ per kWh.
    if (isDefault && f.name === "Natural gas distributed in a pipeline") {
      out.push({
        externalId: "nga-2025-stat-natural-gas-distributed-kwh",
        scope: 1,
        categoryCode: "s1-stationary",
        activityType: "stationary_combustion",
        country: "AU",
        unit: "kWh",
        co2e: round(f.combined * 0.0036),
        notes: `Natural gas distributed in a pipeline (mains gas), kg CO2-e per kWh: ${f.combined} kg CO2-e/GJ x 0.0036 GJ/kWh, on NGA's gross energy content basis. Derived from NGA Factors 2025, Table 5. ${SRC}.`,
      });
    }
  }
  return out;
}

/** Scope 3 upstream emission factors for fuels, from the "Energy - Scope 3" sheet. */
export function upstreamFuelFactors(rows: Row[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const r of rows) {
    const type = cell(r, 0);
    const name = cell(r, 1);
    const unit = cell(r, 6);
    const value = num(r, 5);
    if (!/(Solid|Gaseous|Liquid) fuels/i.test(type) || !name || value == null || !unit) continue;
    const conv = perUnit(value, unit, name);
    const alias = aka(name);
    out.push({
      externalId: `nga-2025-fuel-s3-${slug(name)}-${conv.unit}`,
      scope: 3,
      categoryCode: "s3-fuel-energy",
      activityType: `fuel_energy_upstream_${slug(name)}`,
      country: "AU",
      unit: conv.unit,
      co2e: round(conv.value),
      notes: `${name}${alias ? ` (${alias})` : ""}. Scope 3 upstream emission factor for the consumption of the fuel, kg CO2-e per ${conv.unit}. NGA Factors 2025, "Energy - Scope 3" sheet. ${SRC}.`,
    });
  }
  return out;
}

/** Landfill factors, t CO2-e per t of waste, which is kg per kg. */
export function wasteFactors(table15: Row[], table16: Row[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const r of table16) {
    const name = cell(r, 0);
    const v = num(r, 1);
    if (!name || v == null) continue;
    const isDefault = /^Municipal solid waste/i.test(name);
    out.push({
      externalId: `nga-2025-waste-landfill-${slug(name)}-kg`,
      scope: 3,
      categoryCode: "s3-waste",
      activityType: isDefault ? "waste_disposal" : `waste_landfilled_${slug(name)}`,
      country: "AU",
      unit: "kg",
      co2e: v,
      notes: `${name}, disposed to landfill (landfill). Scope 3 emission factor for the broad waste stream, kg CO2-e per kg (t CO2-e per t). NGA Factors 2025, Table 16. ${SRC}.`,
    });
  }
  for (const r of table15) {
    const name = cell(r, 0);
    const v = num(r, 1);
    if (!name || v == null) continue;
    out.push({
      externalId: `nga-2025-waste-landfill-mix-${slug(name)}-kg`,
      scope: 3,
      categoryCode: "s3-waste",
      activityType: `waste_landfilled_${slug(name)}`,
      country: "AU",
      unit: "kg",
      co2e: v,
      notes: `${name}, disposed to landfill (landfill). Scope 3 emission factor for the waste type, kg CO2-e per kg (t CO2-e per t). NGA Factors 2025, Table 15. ${SRC}.`,
    });
  }
  return out;
}

export function refrigerantFactors(table11: Row[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const r of table11) {
    const label = cell(r, 0);
    const gwp = num(r, 1);
    const m = label.match(/^(R\d+[A-Za-z]?)\s*\((.+)\)/);
    if (!m || gwp == null) continue;
    const code = m[1].toUpperCase();
    out.push({
      externalId: `nga-2025-refrigerant-${slug(code)}-kg`,
      scope: 1,
      categoryCode: "s1-fugitive",
      activityType: `refrigerant_${slug(code)}`,
      country: "AU",
      unit: "kg",
      co2e: gwp,
      notes: `${code.replace(/^R/, "R-")} (${m[2]}) refrigerant leaked, kg CO2-e per kg: the 100-year AR5 GWP. NGA Factors 2025, Table 11. ${SRC}.`,
    });
  }
  return out;
}

export function buildNgaFactors(s: NgaSheets): NationalFactor[] {
  const need = (name: string) => {
    const k = Object.keys(s).find((x) => x.trim() === name);
    if (!k) throw new Error(`NGA sheet not found: ${name}`);
    return s[k];
  };
  const all = [
    ...electricityFactors(need("Table 1"), need("Table 2")),
    ...fuelFactors(need("Energy - Scope 1")),
    ...upstreamFuelFactors(need("Energy - Scope 3")),
    ...wasteFactors(need("Table 15"), need("Table 16")),
    ...refrigerantFactors(need("Table 11")),
  ];
  assertUnique(all);
  return all;
}
