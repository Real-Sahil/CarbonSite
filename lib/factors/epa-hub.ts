// EPA GHG Emission Factors Hub (2025, January 2025) and eGRID2023 (revision 2,
// June 2025) into emission factors for the "EPA 2025.1" library.
//
// Pure: takes the workbooks' rows (header: 1 arrays) and returns factors plus
// the migration SQL. scripts/build-epa-hub-factors.ts reads the files.
//
// Everything is stored per the canonical units of lib/calculation/units.ts
// (litre, kg, kWh, km, pkm, tonne.km), converted here, so a US record in
// gallons or miles is normalised first and then priced. CO2e uses AR5 GWPs
// (CH4 28, N2O 265), the basis EPA publishes, so a calculation on this
// library is AR5 for the gases it combines; the factor notes say so.
//
// Biomass and biofuel CO2 is biogenic: it is stored in biogenicCo2 and left
// out of co2e, as the DEFRA load does.

export const GWP_AR5 = { ch4: 28, n2o: 265 } as const;

const LB_TO_KG = 0.45359237;
const MILE_KM = 1.609344;
const SHORT_TON_KG = 907.18474;
const US_GALLON_L = 3.785411784;
const MMBTU_KWH = 293.07107;

export type EpaFactor = {
  externalId: string;
  scope: 1 | 2 | 3;
  categoryCode: string;
  activityType: string;
  country: string | null;
  unit: string;
  co2: number | null;
  ch4: number | null;
  n2o: number | null;
  co2e: number;
  biogenicCo2: number | null;
  notes: string;
};

type Row = unknown[];
const cell = (r: Row, i: number) => (r[i] == null ? "" : String(r[i]).replace(/\s+/g, " ").trim());
const num = (r: Row, i: number): number | null => {
  const v = r[i];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
};
const round = (n: number) => Number(n.toPrecision(10));
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function section(rows: Row[], heading: RegExp): { start: number; end: number } {
  const start = rows.findIndex((r) => heading.test(`${cell(r, 1)} | ${cell(r, 2)}`));
  if (start < 0) throw new Error(`Hub table not found: ${heading}`);
  let end = start + 1;
  while (end < rows.length && !/^(Source|Notes?)\b/.test(cell(rows[end], 2))) end++;
  return { start, end };
}

/** Gases in kg per unit to a factor; biogenic CO2 stays out of co2e. */
function gases(co2Kg: number | null, ch4Kg: number | null, n2oKg: number | null, biogenic: boolean) {
  const co2e = (biogenic ? 0 : co2Kg ?? 0) + (ch4Kg ?? 0) * GWP_AR5.ch4 + (n2oKg ?? 0) * GWP_AR5.n2o;
  return {
    co2: biogenic ? null : co2Kg,
    ch4: ch4Kg,
    n2o: n2oKg,
    biogenicCo2: biogenic ? co2Kg : null,
    co2e: round(co2e),
  };
}

// Words a record's fuel field is likely to use, added to a factor's notes so
// the selector's detail match finds it (it reads the factor's id, type and notes).
const ALIASES: Record<string, string> = {
  "Distillate Fuel Oil No. 1": "kerosene-grade diesel, heating oil",
  "Distillate Fuel Oil No. 2": "diesel, gas oil, red diesel, heating oil",
  "Motor Gasoline": "gasoline, petrol",
  "Liquefied Petroleum Gases (LPG)": "LPG, autogas",
  Propane: "propane, LPG",
  "Residual Fuel Oil No. 6": "heavy fuel oil, bunker",
  "Diesel Fuel": "diesel, gas oil",
  "Compressed Natural Gas (CNG)": "CNG, natural gas",
  "Liquefied Natural Gas (LNG)": "LNG, natural gas",
  "Kerosene-Type Jet Fuel": "jet fuel, jet A, aviation turbine fuel",
  "Biodiesel (100%)": "biodiesel, B100",
  "Ethanol (100%)": "ethanol, E100",
  "Wood and Wood Residuals": "wood, biomass",
};
const aka = (name: string) => (ALIASES[name] ? ` (${ALIASES[name]})` : "");

// The category default: a record with no fuel text takes this one on the
// activity-type tie-break instead of the alphabetical first. Diesel and
// gasoline mobile and natural gas by kWh already exist in the library.
const SKIP = new Set(["s1-mobile|Diesel Fuel", "s1-mobile|Motor Gasoline", "s1-stationary|Natural Gas|kWh"]);

export function stationaryFactors(rows: Row[]): EpaFactor[] {
  const { start, end } = section(rows, /^Table 1 \|/);
  const out: EpaFactor[] = [];
  let unit: "kg" | "m3" | "litre" = "kg";
  let heading = "";
  for (let i = start + 1; i < end; i++) {
    const r = rows[i];
    const unitHeader = cell(r, 3);
    if (/per short ton$/.test(unitHeader)) { unit = "kg"; continue; }
    if (/per scf$/.test(unitHeader)) { unit = "m3"; continue; }
    if (/per gallon$/.test(unitHeader)) { unit = "litre"; continue; }
    const label = cell(r, 2);
    if (!label) continue;
    const co2 = num(r, 7), ch4 = num(r, 8), n2o = num(r, 9);
    if (co2 == null || ch4 == null || n2o == null) {
      if (num(r, 4) == null) heading = label.replace(/\s+/g, " ");
      continue; // section label, or the kraft pulping liquor rows (no per-unit factor)
    }
    const biogenic = /^Biomass/.test(heading);
    const heat = num(r, 3);
    const mmbtu = (heat ?? 0) * 1; // mmBtu per unit as published
    if (unit === "kg") {
      const f = 1 / SHORT_TON_KG; // per short ton to per kg
      out.push(build(label, "stationary_combustion", "kg", gases(co2 * f, (ch4 * f) / 1000, (n2o * f) / 1000, biogenic), heading, "per short ton"));
    } else if (unit === "litre") {
      const f = 1 / US_GALLON_L;
      out.push(build(label, "stationary_combustion", "litre", gases(co2 * f, (ch4 * f) / 1000, (n2o * f) / 1000, biogenic), heading, "per US gallon"));
    } else if (mmbtu > 0) {
      // Gas by volume is per scf; priced on energy so bills in kWh or therms work (HHV, gross).
      // The published per-mmBtu columns, not the per-scf ones divided back (those are rounded).
      const perMmbtu = { co2: num(r, 4) ?? co2 / mmbtu, ch4: (num(r, 5) ?? ch4 / mmbtu) / 1000, n2o: (num(r, 6) ?? n2o / mmbtu) / 1000 };
      const k = 1 / MMBTU_KWH;
      const key = `s1-stationary|${label}|kWh`;
      if (SKIP.has(key)) continue;
      out.push(build(label, "stationary_combustion", "kWh", gases(perMmbtu.co2 * k, perMmbtu.ch4 * k, perMmbtu.n2o * k, biogenic), heading, "per kWh, higher heating value (gross), from the factor per mmBtu"));
    }
  }
  return out;

  function build(name: string, activityType: string, u: string, g: ReturnType<typeof gases>, group: string, basis: string): EpaFactor {
    return {
      externalId: `epa-2025-hub-stat-${slug(name)}-${u === "kg" ? "kg" : u === "litre" ? "litre" : "kwh"}`,
      scope: 1,
      categoryCode: "s1-stationary",
      activityType: name === "Distillate Fuel Oil No. 2" && u === "litre" ? "stationary_combustion" : `stationary_combustion_${slug(name)}`,
      country: "US",
      unit: u,
      ...g,
      notes: `${name}${aka(name)}. EPA GHG Emission Factors Hub 2025, Table 1 Stationary Combustion (${group}), ${basis}. Combustion only; CO2e with AR5 GWPs.${g.biogenicCo2 != null ? " CO2 is biogenic and reported beside the inventory, not in it." : ""}`,
    };
  }
}

export function mobileFactors(rows: Row[]): EpaFactor[] {
  const { start, end } = section(rows, /^Table 2 \|/);
  const out: EpaFactor[] = [];
  for (let i = start + 1; i < end; i++) {
    const r = rows[i];
    const name = cell(r, 2);
    const v = num(r, 3);
    const u = cell(r, 4);
    if (!name || v == null || (u !== "gallon" && u !== "scf")) continue;
    if (SKIP.has(`s1-mobile|${name}`)) continue;
    const biogenic = /^(Biodiesel|Ethanol)/.test(name);
    // CNG is per scf: no unit the registry converts to energy or litres, so it is not loaded.
    if (u !== "gallon") continue;
    const unit = "litre";
    const k = 1 / US_GALLON_L;
    out.push({
      externalId: `epa-2025-hub-mobile-${slug(name)}-litre`,
      scope: 1,
      categoryCode: "s1-mobile",
      activityType: `mobile_combustion_${slug(name)}`,
      country: "US",
      unit,
      ...gases(v * k, null, null, biogenic),
      notes: `${name}${aka(name)}. EPA GHG Emission Factors Hub 2025, Table 2 Mobile Combustion CO2, per US gallon. Tank-to-wheel CO2 only: the CH4 and N2O of Tables 3 to 5 depend on vehicle and model year and are not added (typically under 1% of the total). AR5 basis.${biogenic ? " CO2 is biogenic and reported beside the inventory, not in it." : ""}`,
    });
  }
  return out;
}

export function heatFactor(rows: Row[]): EpaFactor {
  const { start, end } = section(rows, /^Table 7 \|/);
  for (let i = start + 1; i < end; i++) {
    const r = rows[i];
    if (cell(r, 2) !== "Steam and Heat") continue;
    const k = 1 / MMBTU_KWH;
    return {
      externalId: "epa-2025-hub-steam-heat-kwh",
      scope: 2,
      categoryCode: "s2-heat",
      activityType: "purchased_heat",
      country: "US",
      unit: "kWh",
      ...gases(num(r, 3)! * k, (num(r, 4)! / 1000) * k, (num(r, 5)! / 1000) * k, false),
      notes: "Purchased steam and heat, per kWh (converted from mmBtu). EPA GHG Emission Factors Hub 2025, Table 7: assumes natural gas at 80% thermal efficiency, combustion only. AR5 basis.",
    };
  }
  throw new Error("Hub Table 7 Steam and Heat row not found");
}

const FOOTNOTE = /(?:\s|(?<=[a-z)]))[A-E]$/;
const clean = (s: string) => s.replace(FOOTNOTE, "").trim();

function unitFactor(unit: string): { u: string; k: number } | null {
  if (unit === "vehicle-mile") return { u: "km", k: 1 / MILE_KM };
  if (unit === "passenger-mile") return { u: "pkm", k: 1 / MILE_KM };
  if (unit === "short ton-mile") return { u: "tonne.km", k: 1 / ((SHORT_TON_KG / 1000) * MILE_KM) };
  return null;
}

type Transport = { name: string; unit: string; co2: number; ch4: number; n2o: number };
function transportRows(rows: Row[], heading: RegExp): Transport[] {
  const { start, end } = section(rows, heading);
  const out: Transport[] = [];
  for (let i = start + 1; i < end; i++) {
    const r = rows[i];
    const co2 = num(r, 3), ch4 = num(r, 4), n2o = num(r, 5);
    const unit = cell(r, 6);
    if (co2 == null || ch4 == null || n2o == null || !unitFactor(unit)) continue;
    out.push({ name: clean(cell(r, 2)), unit, co2, ch4, n2o });
  }
  return out;
}

function transport(t: Transport, categoryCode: string, activityType: string, idPrefix: string, table: string): EpaFactor {
  const { u, k } = unitFactor(t.unit)!;
  const g = gases(t.co2 * k, (t.ch4 / 1000) * k, (t.n2o / 1000) * k, false);
  return {
    externalId: `${idPrefix}-${slug(t.name)}-${u.replace(".", "")}`,
    scope: 3,
    categoryCode,
    activityType,
    country: "US",
    unit: u,
    ...g,
    notes: `${t.name}${t.name === "Passenger Car" ? " (car, average)" : t.name === "Motorcycle" ? " (motorbike)" : ""}. EPA GHG Emission Factors Hub 2025, ${table}, per ${u === "km" ? "vehicle" : u === "pkm" ? "passenger" : "tonne"}.km (converted from ${t.unit}). Combustion only; AR5 basis.`,
  };
}

export function freightFactors(rows: Row[]): EpaFactor[] {
  const t = transportRows(rows, /^Table 8 \|/);
  const out: EpaFactor[] = [];
  for (const row of t) {
    // The category default for a tonne.km record with no mode named is the average truck.
    const truck = /^Medium- and Heavy-Duty Truck/.test(row.name) && row.unit === "short ton-mile";
    out.push(transport(row, "s3-upstream-transport", truck ? "upstream_transport" : `freight_${slug(row.name)}`, "epa-2025-hub-up", "Table 8 (Scope 3 Category 4)"));
    out.push(transport(row, "s3-downstream-transport", truck ? "downstream_transport" : `freight_${slug(row.name)}`, "epa-2025-hub-down", "Table 8 (Scope 3 Category 9)"));
  }
  return out;
}

export function travelFactors(rows: Row[]): EpaFactor[] {
  const t = transportRows(rows, /^Table 10 \|/);
  const out: EpaFactor[] = [];
  const COMMUTE = /^(Passenger Car|Light-Duty Truck|Motorcycle|Intercity Rail|Commuter Rail|Transit Rail|Bus)/;
  for (const row of t) {
    // A km record with no mode named is an average car, as in the DEFRA load.
    const car = row.name === "Passenger Car";
    out.push(transport(row, "s3-business-travel", car ? "business_travel" : `business_travel_${slug(row.name)}`, "epa-2025-hub-travel", "Table 10 (Scope 3 Category 6)"));
    if (COMMUTE.test(row.name)) {
      out.push(transport(row, "s3-commuting", car ? "employee_commuting" : `employee_commuting_${slug(row.name)}`, "epa-2025-hub-commute", "Table 10 (Scope 3 Category 7)"));
    }
  }
  return out;
}

const TREATMENTS: { col: number; key: string; label: string }[] = [
  { col: 3, key: "recycled", label: "Recycled" },
  { col: 4, key: "landfilled", label: "Landfilled" },
  { col: 5, key: "combusted", label: "Combusted" },
  { col: 6, key: "composted", label: "Composted" },
  { col: 7, key: "ad-dry", label: "Anaerobically digested (dry digestate with curing)" },
  { col: 8, key: "ad-wet", label: "Anaerobically digested (wet digestate with curing)" },
];

export function wasteFactors(rows: Row[]): EpaFactor[] {
  const { start, end } = section(rows, /^Table 9 \|/);
  const out: EpaFactor[] = [];
  for (let i = start + 1; i < end; i++) {
    const r = rows[i];
    const material = cell(r, 2);
    if (!material || /^Material\b/.test(material) || /^Metric Tons/.test(material)) continue;
    for (const t of TREATMENTS) {
      const v = num(r, t.col);
      if (v == null) continue; // "NA"
      // Mixed MSW to landfill is the category default (a record naming no material or route).
      const isDefault = material === "Mixed MSW" && t.key === "landfilled";
      out.push({
        externalId: `epa-2025-hub-waste-${slug(material)}-${t.key}-kg`,
        scope: 3,
        categoryCode: "s3-waste",
        activityType: isDefault ? "waste_disposal" : `waste_${t.key}_${slug(material)}`,
        country: "US",
        unit: "kg",
        co2: null,
        ch4: null,
        n2o: null,
        co2e: round((v * 1000) / SHORT_TON_KG),
        biogenicCo2: null,
        notes: `${material}, ${t.label.toLowerCase()}${t.key === "landfilled" ? " (landfill)" : t.key === "combusted" ? " (incineration, combustion)" : t.key === "recycled" ? " (recycling)" : ""}. EPA GHG Emission Factors Hub 2025, Table 9 (WARM-based, Scope 3 Categories 5 and 12), per kg (converted from metric tons CO2e per short ton). Excludes avoided emissions.`,
      });
    }
  }
  return out;
}

export function refrigerantFactors(rows: Row[]): EpaFactor[] {
  const out: EpaFactor[] = [];
  const single = section(rows, /^Table 11 \|/);
  for (let i = single.start + 1; i < single.end; i++) {
    const r = rows[i];
    const name = cell(r, 2);
    const formula = cell(r, 3);
    const gwp = num(r, 4);
    if (!/^HFC-/.test(name) || gwp == null) continue;
    const designation = name.replace(/^HFC-/, "R-");
    out.push({
      externalId: `epa-2025-hub-refrigerant-${slug(name)}-kg`,
      scope: 1,
      categoryCode: "s1-fugitive",
      activityType: `refrigerant_${slug(name)}`,
      country: null,
      unit: "kg",
      co2: null, ch4: null, n2o: null,
      co2e: gwp,
      biogenicCo2: null,
      notes: `${name} (${designation}, ${formula}) refrigerant leaked, kg CO2e per kg: the 100-year AR5 GWP. EPA GHG Emission Factors Hub 2025, Table 11.`,
    });
  }
  const blends = section(rows, /^Table 12 \|/);
  for (let i = blends.start + 1; i < blends.end; i++) {
    const r = rows[i];
    const name = cell(r, 2);
    const gwp = num(r, 3);
    if (!/^R-\d/.test(name) || gwp == null) continue;
    out.push({
      externalId: `epa-2025-hub-refrigerant-${slug(name)}-kg`,
      scope: 1,
      categoryCode: "s1-fugitive",
      activityType: `refrigerant_${slug(name)}`,
      country: null,
      unit: "kg",
      co2: null, ch4: null, n2o: null,
      co2e: gwp,
      biogenicCo2: null,
      notes: `${name} blend (${cell(r, 4)}) refrigerant leaked, kg CO2e per kg: the 100-year AR5 GWP. EPA GHG Emission Factors Hub 2025, Table 12.`,
    });
  }
  return out;
}

/** eGRID2023 subregion total output emission rates, lb/MWh to kg/kWh. */
export function electricityFactors(subregionRows: Row[], usRows: Row[]): EpaFactor[] {
  const out: EpaFactor[] = [];
  const kg = (lbPerMwh: number) => (lbPerMwh * LB_TO_KG) / 1000;
  const header = subregionRows[1] as string[];
  const col = (n: string) => header.indexOf(n);
  const c = { code: col("SUBRGN"), name: col("SRNAME"), co2: col("SRCO2RTA"), ch4: col("SRCH4RTA"), n2o: col("SRN2ORTA"), co2e: col("SRC2ERTA") };
  if (Object.values(c).some((i) => i < 0)) throw new Error("eGRID SRL23 columns not found");
  const noteFor = (name: string) =>
    `${name}. EPA eGRID2023 (revision 2, June 2025) total output emission rate, per kWh (converted from lb/MWh). Location-based Scope 2 at the point of use: no grid losses, no upstream. CO2e as published by eGRID (AR5).`;
  const US = { code: "US", name: "US average" };
  const usHeader = usRows[1] as string[];
  const usRow = usRows[2] as number[];
  const uc = (n: string) => usRow[usHeader.indexOf(n)];
  out.push({
    externalId: "epa-2025-egrid2023-us-avg-kwh",
    scope: 2,
    categoryCode: "s2-electricity-lb",
    activityType: "purchased_electricity_location",
    country: "US",
    unit: "kWh",
    co2: round(kg(uc("USCO2RTA"))), ch4: round(kg(uc("USCH4RTA"))), n2o: round(kg(uc("USN2ORTA"))),
    co2e: round(kg(uc("USC2ERTA"))),
    biogenicCo2: null,
    notes: noteFor(`${US.name} grid, used when the record or its facility names no eGRID subregion`),
  });
  for (let i = 2; i < subregionRows.length; i++) {
    const r = subregionRows[i];
    const code = cell(r, c.code);
    if (!code) continue;
    const co2 = num(r, c.co2), ch4 = num(r, c.ch4), n2o = num(r, c.n2o), co2e = num(r, c.co2e);
    if (co2 == null || ch4 == null || n2o == null || co2e == null) throw new Error(`eGRID ${code}: a rate is missing`);
    const pr = code === "PRMS"; // the only subregion in Puerto Rico: its own country default
    out.push({
      externalId: `epa-2025-egrid2023-${code.toLowerCase()}-kwh`,
      scope: 2,
      categoryCode: "s2-electricity-lb",
      activityType: pr ? "purchased_electricity_location" : `egrid_${code.toLowerCase()}`,
      country: pr ? "PR" : "US",
      unit: "kWh",
      co2: round(kg(co2)), ch4: round(kg(ch4)), n2o: round(kg(n2o)), co2e: round(kg(co2e)),
      biogenicCo2: null,
      notes: noteFor(`eGRID subregion ${code} (${cell(r, c.name)})`),
    });
  }
  return out;
}

export function buildEpaHubFactors(input: { hub: Row[]; egridSubregions: Row[]; egridUs: Row[] }): EpaFactor[] {
  const all = [
    ...stationaryFactors(input.hub),
    ...mobileFactors(input.hub),
    ...electricityFactors(input.egridSubregions, input.egridUs),
    heatFactor(input.hub),
    ...freightFactors(input.hub),
    ...wasteFactors(input.hub),
    ...travelFactors(input.hub),
    ...refrigerantFactors(input.hub),
  ];
  const seen = new Set<string>();
  for (const f of all) {
    if (seen.has(f.externalId)) throw new Error(`duplicate id ${f.externalId}`);
    seen.add(f.externalId);
  }
  return all;
}

const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;
const dec = (n: number | null) => (n == null ? "NULL" : String(n));

export function buildEpaHubMigrationSql(factors: EpaFactor[], files: string[]): string {
  const counts = new Map<string, number>();
  for (const f of factors) counts.set(f.categoryCode, (counts.get(f.categoryCode) ?? 0) + 1);
  const rows = factors.map(
    (f) =>
      `    (${sql(f.externalId)}, ${f.scope}, ${sql(f.categoryCode)}, ${sql(f.activityType)}, ${f.country ? sql(f.country) : "NULL"}, ${sql(f.unit)}, ${dec(f.co2)}, ${dec(f.ch4)}, ${dec(f.n2o)}, ${dec(f.co2e)}, ${dec(f.biogenicCo2)}, ${sql(f.notes)})`,
  );
  return `-- EPA GHG Emission Factors Hub 2025 (January 2025) and eGRID2023 revision 2 (June 2025): ${factors.length} factors added to the "EPA" 2025.1 library.
-- Generated by scripts/build-epa-hub-factors.ts from ${files.join(", ")}. Do not edit by hand.
-- Per category: ${[...counts].sort().map(([c, n]) => `${c} ${n}`).join(", ")}.
-- Values are converted to the canonical units (litre, kg, kWh, km, pkm, tonne.km). CO2e uses AR5 GWPs, EPA's basis.
-- eGRID subregion rows (activity type egrid_<code>) are chosen only when the record or its facility names the
-- subregion (lib/calculation/egrid-subregion.ts); otherwise the US average row applies.
-- Additive: inserts only what is missing.

INSERT INTO "factor_libraries" ("id", "name", "version", "license", "source_url", "published_at", "created_at")
VALUES (gen_random_uuid()::text, 'EPA', '2025.1', 'Public Domain (US Government Work)', 'https://www.epa.gov/climateleadership/ghg-emission-factors-hub', DATE '2025-01-01', now())
ON CONFLICT ("name", "version") DO NOTHING;

WITH lib AS (
  SELECT "id" FROM "factor_libraries" WHERE "name" = 'EPA' AND "version" = '2025.1'
), src ("external_id", "scope", "category_code", "activity_type", "geography_country", "input_unit", "co2", "ch4", "n2o", "co2e", "biogenic_co2", "usage_notes") AS (
  VALUES
${rows.join(",\n")}
)
INSERT INTO "emission_factors" ("id", "factor_library_id", "external_id", "scope", "emission_category_id", "activity_type", "geography_country", "input_unit", "co2", "ch4", "n2o", "co2e", "biogenic_co2", "usage_notes")
SELECT gen_random_uuid()::text, lib."id", src."external_id", src."scope", c."id", src."activity_type", src."geography_country", src."input_unit", src."co2", src."ch4", src."n2o", src."co2e", src."biogenic_co2", src."usage_notes"
FROM src
CROSS JOIN lib
JOIN "emission_categories" c ON c."code" = src."category_code"
ON CONFLICT ("factor_library_id", "external_id") DO NOTHING;
`;
}
