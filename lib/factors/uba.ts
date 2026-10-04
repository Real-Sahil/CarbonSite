// Umweltbundesamt (UBA) list of emission factors for the greenhouse gas
// accounting of organisations, version 2.1 (March 2026), into the "UBA"
// library, version "2.1".
//
// Source workbook: uba_liste_ef_für_thg_bilanzierung_v2.1.xlsx. The data are
// published under CC0 1.0 (workbook sheet "Impressum"); UBA asks that the
// source is named and that changes are marked. Every factor note names the
// workbook ID, and the migration header says the rows were restructured.
//
// Loaded (reference year 2024 unless the row says otherwise):
//   01 Stationary combustion (Scope 1)            s1-stationary
//   02 Mobile combustion, by fuel and by distance s1-mobile
//   04 Refrigerant GWPs (F-gas Regulation column) s1-fugitive
//   05 German electricity mix (Scope 2, upstream) s2-electricity-lb, s3-fuel-energy
//   06 District heat, Scope 2                     s2-heat
//   07 Upstream fuel factors (Scope 3 chain)      s3-fuel-energy
//   08 Business travel and commuting by distance  s3-business-travel, s3-commuting
//   09 Freight by distance                        s3-upstream-transport, s3-downstream-transport
// Not loaded: renewable electricity by source, sheets 03, 10, 11 and 12, and
// the biogenic CO2 "outside the scopes" sheet.
//
// Units: UBA's kWh are lower heating value (net calorific value) unless the row
// says Brennwert (gross), so they load as kWh_ncv and kWh respectively, never
// converted into each other (lib/calculation/units.ts).

import { assertUnique, round, slug, type NationalFactor } from "./national-load";

type Row = unknown[];
export type UbaSheets = Record<string, Row[]>;

const cell = (r: Row, i: number) => (r[i] == null ? "" : String(r[i]).replace(/\s+/g, " ").trim());
const numAt = (r: Row, i: number): number | null => {
  const v = r[i];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
};

const ID = /^(\d\d)_(\d\d)_(\d\d)_(\d{3})_(\d\d)$/;

type UbaRow = {
  id: string;
  sheet: string;
  scope: number; // 10, 20, 31, 32
  levels: string[];
  unit: string;
  co2e: number;
  co2: number | null;
  ch4: number | null;
  n2o: number | null;
  year: number | null;
};

/** The rows of one factor sheet, with the columns found by their header names. */
export function readSheet(sheet: string, rows: Row[]): UbaRow[] {
  const hi = rows.findIndex((r) => cell(r, 0) === "ID");
  if (hi < 0) return [];
  const header = (rows[hi] as unknown[]).map((h) => String(h ?? "").replace(/\s+/g, " ").trim());
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iUnit = col(/^Einheit$/);
  const iCo2e = col(/^kg CO2e$/);
  const iCo2 = col(/^kg CO2$/);
  const iCh4 = col(/^kg CH4$/);
  const iN2o = col(/^kg N2O$/);
  const iYear = col(/^Bezugsjahr$/);
  const iFirstLevel = col(/^Level 1$/);
  if (iUnit < 0 || iCo2e < 0 || iFirstLevel < 0) throw new Error(`UBA ${sheet}: columns not found`);
  const out: UbaRow[] = [];
  for (const r of rows.slice(hi + 1)) {
    const m = String(r[0] ?? "").trim().match(ID);
    const co2e = numAt(r, iCo2e);
    if (!m || co2e == null) continue;
    out.push({
      id: String(r[0]).trim(),
      sheet,
      scope: Number(m[2]),
      levels: r.slice(iFirstLevel, iUnit).map((c) => String(c ?? "").replace(/\s+/g, " ").trim()).filter(Boolean),
      unit: cell(r, iUnit),
      co2e,
      co2: iCo2 >= 0 ? numAt(r, iCo2) : null,
      ch4: iCh4 >= 0 ? numAt(r, iCh4) : null,
      n2o: iN2o >= 0 ? numAt(r, iN2o) : null,
      year: iYear >= 0 ? numAt(r, iYear) : null,
    });
  }
  return out;
}

const UNIT: Record<string, string> = { kWh: "kWh", l: "litre", kg: "kg", t: "tonne", "m³": "m3", m3: "m3", km: "km", pkm: "pkm", tkm: "tonne.km" };

const WORDS: [RegExp, string][] = [
  [/Dieselkraftstoff/i, "diesel, gas oil"],
  [/Heizöl/i, "heating oil, light fuel oil, gas oil"],
  [/Benzin|Ottokraftstoff/i, "petrol, gasoline"],
  [/Erdgas \(CNG\)/i, "CNG, natural gas"],
  [/Flüssigerdgas|LNG/i, "LNG, natural gas"],
  [/Erdgas/i, "natural gas, mains gas"],
  [/Flüssiggas|LPG/i, "LPG, propane"],
  [/Kerosin/i, "jet fuel, kerosene, aviation turbine fuel"],
  [/Flugbenzin/i, "AvGas, aviation gasoline"],
  [/Schweröl/i, "heavy fuel oil, HFO"],
  [/Steinkohle|^Kohle$/i, "coal, hard coal"],
  [/Braunkohle/i, "lignite, brown coal"],
  [/Biodiesel/i, "biodiesel, B100"],
  [/Bioethanol/i, "bioethanol, ethanol"],
  [/Biomethan/i, "biomethane"],
  [/Biogas/i, "biogas"],
  [/Deponiegas/i, "landfill gas"],
  [/Klärgas/i, "sewage gas"],
  [/feste Biomasse|Holz|Pellets|Hackschnitzel/i, "wood, biomass, pellets, wood chips"],
  [/Pkw/i, "car, passenger car"],
  [/Elektromotor/i, "electric, BEV, battery electric"],
  [/Plug-In-Hybrid/i, "plug-in hybrid, PHEV"],
  [/Dieselmotor/i, "diesel"],
  [/Benzinmotor/i, "petrol"],
  [/Zweirad|Motorrad|Kleinkraftrad/i, "motorbike, motorcycle"],
  [/E-Bike/i, "e-bike, electric bike"],
  [/\bBus\b|Linienbus/i, "bus, coach"],
  [/\bZug\b|Güterzug|Schiene/i, "train, rail"],
  [/Flugzeug|\bLuft\b/i, "flight, aeroplane, air, aircraft"],
  [/Leichtes Nutzfahrzeug|Leichte Nutzfahrzeuge/i, "van, light commercial vehicle, LCV"],
  [/Schweres Nutzfahrzeug|Solo-LKW|Sattel|Lastzug/i, "HGV, heavy goods vehicle, lorry, truck"],
  [/Binnenschiff|Schiff|Wasser/i, "ship, barge, inland waterway"],
  [/Strommix/i, "electricity, grid, mains electricity"],
  [/Fernwärme/i, "district heat, district heating, heat network"],
];
const aliases = (text: string) => [...new Set(WORDS.filter(([re]) => re.test(text)).map(([, w]) => w))].join("; ");

const SRC = "Umweltbundesamt (UBA), Liste mit Emissionsfaktoren für die Treibhausgasbilanzierung von Organisationen, Version 2.1 (März 2026), CC0 1.0";

function build(
  row: UbaRow,
  o: { category: string; scope: 1 | 2 | 3; activityType: string; suffix?: string; unit?: string; extra?: string },
): NationalFactor {
  const unit = o.unit ?? UNIT[row.unit];
  const path = row.levels.slice(0, 6).join(" > ");
  const al = aliases(path);
  const scopeText = row.scope === 10 ? "Scope 1" : row.scope === 20 ? "Scope 2" : row.scope === 31 ? "Scope 3, upstream chain" : "Scope 3, total";
  return {
    externalId: `uba-2.1-${row.id}${o.suffix ?? ""}`,
    scope: o.scope,
    categoryCode: o.category,
    activityType: o.activityType,
    country: "DE",
    unit,
    co2: row.co2 == null ? null : round(row.co2),
    ch4: row.ch4 == null ? null : round(row.ch4),
    n2o: row.n2o == null ? null : round(row.n2o),
    co2e: round(row.co2e),
    notes: `${path}${al ? ` (${al})` : ""}. ${scopeText}, kg CO2e per ${unit}${row.year ? `, reference year ${row.year}` : ""}. ${o.extra ?? ""}UBA Emissionsfaktorenliste v2.1, ID ${row.id}. Source: ${SRC}.`,
  };
}

const tail = (row: UbaRow) => slug(row.levels.slice(-3).join("-"));

export function stationary(rows: UbaRow[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const r of rows) {
    if (r.scope !== 10 || !UNIT[r.unit]) continue;
    const gross = /Brennwert/i.test(r.levels.join(" "));
    const unit = r.unit === "kWh" && !gross ? "kWh_ncv" : UNIT[r.unit];
    const isDefault =
      (r.unit === "kWh" && /Erdgas \(Brennwert\)/.test(r.levels.join(" "))) || (r.unit === "l" && /Heizöl, leicht/.test(r.levels.join(" ")));
    out.push(
      build(r, {
        category: "s1-stationary",
        scope: 1,
        activityType: isDefault ? "stationary_combustion" : `stationary_combustion_${tail(r)}`,
        unit,
        extra: unit === "kWh_ncv" ? "kWh on a net calorific value (lower heating value) basis. " : gross ? "kWh on a gross (Brennwert) basis, as on gas bills. " : "",
      }),
    );
  }
  return out;
}

export function mobile(rows: UbaRow[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const r of rows) {
    if (r.scope !== 10 || !UNIT[r.unit]) continue;
    const byFuel = /Kraftstoffverbrauch/i.test(r.levels[1] ?? "");
    const unit = r.unit === "kWh" ? "kWh_ncv" : UNIT[r.unit];
    const isDefault =
      (byFuel && r.unit === "l" && /Dieselkraftstoff/.test(r.levels.join(" "))) ||
      (!byFuel && r.unit === "km" && /Personenfahrzeuge > Pkw > Unbekannter Antrieb/.test(r.levels.join(" > ")));
    out.push(
      build(r, {
        category: "s1-mobile",
        scope: 1,
        activityType: isDefault ? "mobile_combustion" : `mobile_combustion_${tail(r)}`,
        unit,
        extra: r.unit === "kWh" ? "kWh on a net calorific value basis. " : byFuel ? "Tank-to-wheel. " : "",
      }),
    );
  }
  return out;
}

/** German mix only: scope 2 for location-based electricity and the upstream chain for category 3. */
export function electricity(rows: UbaRow[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const r of rows) {
    if (!/^Deutscher Strommix$/i.test(r.levels[1] ?? "") || r.unit !== "kWh") continue;
    if (r.scope === 20) out.push(build(r, { category: "s2-electricity-lb", scope: 2, activityType: "purchased_electricity_location", extra: "Location-based, German grid mix. " }));
    else if (r.scope === 31) out.push(build(r, { category: "s3-fuel-energy", scope: 3, activityType: "fuel_energy_activities", extra: "Upstream chain of German electricity, including grid losses. " }));
  }
  return out;
}

export function heat(rows: UbaRow[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const r of rows) {
    if (r.scope !== 20 || r.unit !== "kWh") continue;
    out.push(build(r, { category: "s2-heat", scope: 2, activityType: /fossiler Fernwärme-Mix/i.test(r.levels.join(" ")) ? "purchased_heat" : `purchased_heat_${tail(r)}` }));
  }
  return out;
}

export function upstreamFuels(rows: UbaRow[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const r of rows) {
    if (r.scope !== 31 || !UNIT[r.unit]) continue;
    const gross = /Brennwert/i.test(r.levels.join(" "));
    const unit = r.unit === "kWh" && !gross ? "kWh_ncv" : UNIT[r.unit];
    out.push(build(r, { category: "s3-fuel-energy", scope: 3, activityType: `fuel_energy_upstream_${tail(r)}`, unit, extra: "Upstream chain only (production and supply of the fuel). " }));
  }
  return out;
}

export function travel(rows: UbaRow[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const r of rows) {
    if (r.scope !== 32 || !["km", "pkm"].includes(r.unit)) continue;
    const isDefault = /Pkw > Unbekannter Antrieb\/Durchschnitt/.test(r.levels.join(" > "));
    out.push(build(r, { category: "s3-business-travel", scope: 3, activityType: isDefault ? "business_travel" : `business_travel_${tail(r)}`, suffix: "-bt" }));
    if (/> Land >/.test(r.levels.join(" > "))) {
      out.push(build(r, { category: "s3-commuting", scope: 3, activityType: isDefault ? "employee_commuting" : `employee_commuting_${tail(r)}`, suffix: "-com" }));
    }
  }
  return out;
}

export function freight(rows: UbaRow[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const r of rows) {
    if (r.scope !== 32 || !["km", "tkm"].includes(r.unit)) continue;
    const isDefault = /Schweres Nutzfahrzeug \(> ?3,5 t\) > Durchschnittliche Größe\/unbekannt/.test(r.levels.join(" > "));
    for (const [cat, base, suffix] of [
      ["s3-upstream-transport", "upstream_transport", "-up"],
      ["s3-downstream-transport", "downstream_transport", "-down"],
    ] as const) {
      out.push(build(r, { category: cat, scope: 3, activityType: isDefault ? base : `${base}_${tail(r)}`, suffix }));
    }
  }
  return out;
}

/** Refrigerant GWPs: the F-gas Regulation column (AR5 where that column is empty). kg CO2e per kg. */
export function refrigerants(rows: Row[]): NationalFactor[] {
  const out: NationalFactor[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = cell(r, 0);
    if (!/^04_10_\d\d_\d{3}_XX$/.test(id)) continue;
    // Table 4 (blends) has the composition in column 2; the others have the chemical name there.
    const name = cell(r, 1) || cell(r, 2) || cell(r, 3);
    const gwp = numAt(r, 6) ?? numAt(r, 5) ?? numAt(r, 4);
    if (!name || gwp == null) continue;
    const code = slug(name.replace(/^(HFKW|HFCKW|FKW|HFE|HCFE)-/i, "r-"));
    const ext = `uba-2.1-${id}`;
    if (seen.has(ext)) continue;
    seen.add(ext);
    const alias = /^(HFKW|HFCKW|FKW)-(\d+\w*)/i.test(name) ? `R-${name.match(/-(\d+\w*)/i)![1]}, HFC-${name.match(/-(\d+\w*)/i)![1]}` : "";
    out.push({
      externalId: ext,
      scope: 1,
      categoryCode: "s1-fugitive",
      activityType: `refrigerant_${code}`,
      country: "DE",
      unit: "kg",
      co2e: gwp,
      notes: `${name}${alias ? ` (${alias})` : ""} refrigerant leaked, kg CO2e per kg: 100-year GWP in the column of the F-gas Regulation (EU) 2024/573 as listed by UBA (AR5 where that column is empty). UBA Emissionsfaktorenliste v2.1, ID ${id}. Source: ${SRC}.`,
    });
  }
  return out;
}

export function buildUbaFactors(sheets: UbaSheets): NationalFactor[] {
  const find = (prefix: string) => {
    const k = Object.keys(sheets).find((x) => x.startsWith(prefix));
    if (!k) throw new Error(`UBA sheet not found: ${prefix}`);
    return { name: k, rows: sheets[k] };
  };
  const read = (prefix: string) => {
    const s = find(prefix);
    return readSheet(s.name, s.rows);
  };
  const all = [
    ...stationary(read("01_")),
    ...mobile(read("02_")),
    ...refrigerants(find("04_").rows),
    ...electricity(read("05_")),
    ...heat(read("06_")),
    ...upstreamFuels(read("07_")),
    ...travel(read("08_")),
    ...freight(read("09_")),
  ];
  assertUnique(all);
  return all;
}
