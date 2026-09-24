// ADEME Base Carbone (France), full CSV export from data.ademe.fr, licensed
// under Licence Ouverte v2.0 (Etalab). Pure: turns the export into factor rows
// this platform can apply; scripts/build-ademe-factors.ts writes the migration.
//
// Only valid generic emission factors ("Valide générique", "Facteur
// d'émission") are loaded; archived and site-specific rows are not. Each kept
// row is mapped to one of our seeded category codes, and every row that is
// not kept is counted under the reason it was skipped, so nothing is silently
// dropped or priced under the wrong category:
//   s2-electricity-lb   France grid mix by year ("YYYY - mix moyen",
//                       consumption), power-station combustion only. Grid
//                       losses and upstream are Scope 3.3 under the GHG
//                       Protocol, so they are left out. Each year is effective
//                       for that calendar year; the latest year stays open.
//   s1-stationary       Fuels, the Combustion post only (upstream is Scope
//   s1-mobile           3.3), per litre / kg / tonne / m3 / kWh PCS (gross).
//                       Liquid fuels per litre also go in s1-mobile.
//                       kWh PCI (net CV), GJ, MJ and tep rows are skipped: UK
//                       and French gas bills are gross, and a net factor on a
//                       gross reading understates gas by about 10%.
//   s3-purchased-goods  Spend ratios (kgCO2e per k€ excl. VAT of a stated
//                       year) for the latest year published, as per EUR with
//                       that price year and a NAF division (naf_<2 digits>),
//                       and goods per kg / tonne / unit.
//   s3-waste            Waste treatment per tonne.
//   s3-business-travel  Passenger transport per passenger.km or vehicle km,
//   s3-upstream-transport  freight per tonne.km, less vehicle manufacture.
//   s1-fugitive         IPCC AR6 100-year GWPs per kg released.
//   s2-heat             Heat and cooling networks per kWh delivered: the
//                       national "other networks" defaults (heat, cooling),
//                       and every named network, which is only used when a
//                       record names it (lib/calculation/heat-network.ts).
//
// Also loaded: electricity mixes, goods and transport for other countries and
// the French overseas territories (by ISO country, from the sub-location), fuels for the
// overseas territories and Europe (Europe with no country), and fuels on a
// net calorific value basis (PCI) as per kWh_ncv, converted from GJ, MJ or
// tep when ADEME gives no per-kWh row. Not loaded: land use change (UTCF,
// per hectare, which belongs to the GHG Protocol Land Sector standard, not
// the corporate inventory categories here), electricity split by end use,
// and the territorial statistics.

import { parseCsv } from "./useeio";

export const ADEME_LIBRARY = {
  name: "ADEME Base Carbone",
  license: "Licence Ouverte v2.0 (Etalab)",
  sourceUrl: "https://data.ademe.fr/datasets/base-carboner",
} as const;

export type AdemeFactor = {
  externalId: string;
  categoryCode: string;
  activityType: string;
  geographyCountry: string | null;
  inputUnit: string;
  co2e: number;
  biogenicCo2: number | null;
  priceBaseYear: number | null;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  usageNotes: string;
};

export type AdemeBuild = { factors: AdemeFactor[]; skipped: Record<string, number>; version: string; spendYear: number | null };

type Row = Record<string, string>;
type Poste = { type: string; name: string; total: number | null; co2b: number | null };

const REQUIRED = [
  "Type Ligne", "Identifiant de l'élément", "Type de l'élément", "Statut de l'élément", "Nom base français",
  "Nom attribut français", "Nom frontière français", "Code de la catégorie", "Unité français",
  "Localisation géographique", "Date de modification", "Période de validité", "Commentaire français",
  "Type poste", "Nom poste français", "Total poste non décomposé", "CO2b",
];

const num = (v: string | undefined) => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const clean = (s: string | undefined) => (s ?? "").replace(/["\t]+/g, " ").replace(/\s+/g, " ").trim();

function unitOf(frUnit: string): string | null {
  const u = frUnit.trim().toLowerCase();
  if (/^kgco2e\/litre$/.test(u)) return "litre";
  if (/^kgco2e\/kg( de poids (net|vif))?$/.test(u)) return "kg";
  if (/^kgco2e\/tonne( de déchets)?$/.test(u)) return "tonne";
  if (/^kgco2e\/m3( \(n\))?$/.test(u)) return "m3";
  if (/^kgco2e\/kwh pcs$/.test(u)) return "kWh";
  if (/^kgco2e\/kwh$/.test(u)) return "kWh";
  if (/^kgco2e\/unité$/.test(u)) return "unit";
  if (/^kgco2e\/passager\.km$/.test(u)) return "passenger.km";
  if (/^kgco2e\/km$/.test(u)) return "km";
  if (/^kgco2e\/(t|tonne)\.km$/.test(u)) return "tonne.km";
  return null;
}

/** The NAF (NACE Rev. 2) division in an ADEME comment such as "NAF-N79 - ...". */
export function nafFromComment(comment: string): string | null {
  return comment.match(/\bNAF-?[A-U]?(\d{2})\b/)?.[1] ?? null;
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^(la|le|les|l')\s*/, "").replace(/[^a-z]+/g, " ").trim();

let regionIndex: Map<string, string> | null = null;
/** ISO 3166 alpha-2 code for a country or territory name in French or English. */
export function isoCountry(name: string): string | null {
  if (!regionIndex) {
    regionIndex = new Map();
    const fr = new Intl.DisplayNames(["fr"], { type: "region" });
    const en = new Intl.DisplayNames(["en"], { type: "region" });
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const a of A) for (const b of A) {
      const code = a + b;
      for (const dn of [fr, en]) {
        let label: string | undefined;
        try { label = dn.of(code); } catch { label = undefined; }
        // Deprecated codes (DD, CS, YU...) display as their successor's name.
        if (label && label !== code && Intl.getCanonicalLocales(`und-${code}`)[0] === `und-${code}` && !regionIndex.has(fold(label))) {
          regionIndex.set(fold(label), code);
        }
      }
    }
    for (const [k, v] of Object.entries({ "royaume uni": "GB", "etats unis": "US", "republique tcheque": "CZ", "coree du sud": "KR", "taiwan": "TW", "russie": "RU" })) regionIndex.set(k, v);
  }
  return regionIndex.get(fold(name)) ?? null;
}

/** Where a row applies: an ISO country, null for a world or Europe-wide average, undefined when unusable. */
function placeOf(r: Row, allowEurope: boolean): string | null | undefined {
  const geo = r["Localisation géographique"];
  if (geo === "France continentale") return "FR";
  if (geo === "Monde") return null;
  if (geo === "Europe") return allowEurope ? null : undefined;
  if (geo === "Outre-mer" || geo === "Autre pays du monde") {
    const sub = (r["Sous-localisation géographique anglais"] || r["Sous-localisation géographique français"] || "").split(",")[0].trim();
    return (sub && isoCountry(sub)) || undefined;
  }
  return undefined;
}

/** PCI (net CV) units, as the multiplier from the unit to kWh_ncv. */
const NCV_UNITS: Array<[RegExp, number]> = [
  [/^kgco2e\/kwh ?pci$/, 1],
  [/^kgco2e\/gj pci$/, 277.778],
  [/^kgco2e\/mj pci$/, 0.277778],
  [/^kgco2e\/tep pci$/, 11630],
];

export function buildAdemeFactors(text: string): AdemeBuild {
  const [header, ...lines] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) throw new Error("The file is empty.");
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`Not a Base Carbone export: missing column(s) ${missing.join(", ")}.`);
  const rows: Row[] = lines.map((l) => Object.fromEntries(header.map((h, i) => [h, l[i] ?? ""])));

  const postes = new Map<string, Poste[]>();
  for (const r of rows) {
    if (r["Type Ligne"] !== "Poste") continue;
    const list = postes.get(r["Identifiant de l'élément"]) ?? [];
    list.push({ type: r["Type poste"], name: r["Nom poste français"], total: num(r["Total poste non décomposé"]), co2b: num(r["CO2b"]) });
    postes.set(r["Identifiant de l'élément"], list);
  }

  const skipped: Record<string, number> = {};
  const skip = (why: string) => { skipped[why] = (skipped[why] ?? 0) + 1; };
  const factors: AdemeFactor[] = [];
  const seen = new Set<string>();
  const push = (f: AdemeFactor) => {
    if (seen.has(f.externalId)) throw new Error(`Duplicate factor id ${f.externalId}.`);
    seen.add(f.externalId);
    factors.push(f);
  };

  const otherGrid: AdemeFactor[] = [];
  const extraFuels = new Map<string, { rank: number; f: AdemeFactor }>();
  const directFuels = new Set<string>();

  const elements = rows.filter((r) => r["Type Ligne"] === "Elément");
  const valid = elements.filter((r) => {
    if (r["Type de l'élément"] !== "Facteur d'émission") return skip("not an emission factor (source data)"), false;
    if (r["Statut de l'élément"] !== "Valide générique") return skip(`status ${r["Statut de l'élément"] || "blank"}`), false;
    return true;
  });

  // Spend ratios are republished for each year; keep the latest year only.
  const spendYears = valid
    .map((r) => r["Unité français"].match(/keuro \((\d{4})\) HT/i)?.[1])
    .filter(Boolean)
    .map(Number);
  const spendYear = spendYears.length ? Math.max(...spendYears) : null;

  for (const r of valid) {
    const id = r["Identifiant de l'élément"];
    const cat = r["Code de la catégorie"];
    const geo = r["Localisation géographique"];
    const total = num(r["Total poste non décomposé"]);
    const nameFr = [clean(r["Nom base français"]), clean(r["Nom attribut français"]), clean(r["Nom frontière français"])].filter(Boolean).join(" - ");
    const nameEn = [clean(r["Nom base anglais"]), clean(r["Nom attribut anglais"]), clean(r["Nom frontière anglais"])].filter(Boolean).join(" - ");
    const label = nameEn ? `${nameEn} (${nameFr})` : nameFr;
    const ps = postes.get(id) ?? [];
    const withoutManufacture = () => (ps.length ? total! - ps.filter((p) => /^Fabrication/i.test(p.type)).reduce((t, p) => t + (p.total ?? 0), 0) : total!);
    const country = geo === "France continentale" ? "FR" : geo === "Monde" ? null : undefined;
    const base = { biogenicCo2: null, priceBaseYear: null, effectiveStart: null, effectiveEnd: null } as const;
    if (total == null) { skip("no value"); continue; }

    if (/^Electricité > Mix réseau/.test(cat)) {
      if (geo === "France continentale") {
        const year = r["Nom attribut français"].match(/^(\d{4}) - mix moyen$/)?.[1];
        if (!year || r["Nom frontière français"] !== "consommation") { skip("electricity: France split by end use or production, not the annual average mix"); continue; }
        const gen = ps.filter((p) => /^Combustion/i.test(p.type));
        if (!gen.length) { skip("electricity: no power-station post"); continue; }
        push({
          ...base, externalId: `ademe-${id}`, categoryCode: "s2-electricity-lb", activityType: "electricity_grid", geographyCountry: "FR",
          inputUnit: "kWh", co2e: gen.reduce((t, p) => t + (p.total ?? 0), 0),
          effectiveStart: `${year}-01-01`, effectiveEnd: `${year}-12-31`,
          usageNotes: `France grid electricity ${year}, average mix, power-station combustion only (ADEME ${id}; total with upstream and losses ${total}). Location-based Scope 2.`,
        });
        continue;
      }
      if (/production|fabrication/i.test(r["Nom frontière français"])) { skip("electricity: production, not consumption"); continue; }
      const iso = placeOf(r, false);
      if (!iso) { skip("electricity: region without a country"); continue; }
      if (iso === "FR") { skip("electricity: France comes from its annual mix"); continue; }
      if (unitOf(r["Unité français"]) !== "kWh") { skip("electricity: unit"); continue; }
      const gen = ps.filter((p) => /^Combustion/i.test(p.type));
      otherGrid.push({
        ...base, externalId: `ademe-${id}`, categoryCode: "s2-electricity-lb", activityType: "electricity_grid", geographyCountry: iso,
        inputUnit: "kWh", co2e: gen.length ? gen.reduce((t, p) => t + (p.total ?? 0), 0) : total,
        usageNotes: `${clean(r["Sous-localisation géographique anglais"]) || iso} grid electricity, average mix (${label}; ADEME ${id}${gen.length ? `, power-station combustion only, total ${total}` : ""}; valid ${clean(r["Période de validité"]) || "undated"}). Location-based Scope 2.`,
      });
      continue;
    }

    if (/^Réseaux de chaleur/.test(cat)) {
      if (unitOf(r["Unité français"]) !== "kWh") { skip("heat network: unit"); continue; }
      const attr = clean(r["Nom attribut français"]);
      const cooling = /froid/i.test(r["Nom base français"]) || /froid/i.test(attr);
      const generic = /^Autres réseaux/i.test(attr);
      push({
        ...base, externalId: `ademe-${id}`, categoryCode: "s2-heat",
        activityType: generic ? (cooling ? "district_cooling" : "purchased_heat") : (cooling ? "cooling_network" : "heat_network"),
        geographyCountry: "FR", inputUnit: "kWh", co2e: total,
        usageNotes: generic
          ? `France ${cooling ? "district cooling" : "district heating"}, average of other networks (ADEME ${id}). Per kWh delivered.`
          : `${cooling ? "Cooling" : "Heat"} network "${attr}" (${clean(r["Sous-localisation géographique français"])}; ADEME ${id}). Per kWh delivered. Used only when the record names this network.`,
      });
      continue;
    }

    if (/^Combustibles > (Fossiles|Organiques)/.test(cat)) {
      const place = placeOf(r, true);
      if (place === undefined) { skip("fuel: region without a country"); continue; }
      const frUnit = r["Unité français"].trim().toLowerCase();
      const ncv = NCV_UNITS.find(([re]) => re.test(frUnit));
      const gcvGj = /^kgco2e\/gj pcs$/.test(frUnit);
      const unit = ncv ? "kWh_ncv" : gcvGj ? "kWh" : unitOf(r["Unité français"]);
      if (!unit) { skip(`fuel: unit ${r["Unité français"] || "blank"}`); continue; }
      const scale = ncv ? ncv[1] : gcvGj ? 277.778 : 1;
      const comb = ps.filter((p) => /^Combustion/i.test(p.type));
      if (!comb.length) { skip("fuel: no combustion post"); continue; }
      const co2e = comb.reduce((t, p) => t + (p.total ?? 0), 0) / scale;
      const bioRaw = comb.reduce((t, p) => t + (p.co2b ?? 0), 0) || num(r["CO2b"]);
      const bio = bioRaw ? bioRaw / scale : null;
      const converted = scale !== 1 ? ` Converted from ${r["Unité français"]} (÷ ${scale}).` : "";
      const f = {
        ...base, activityType: "fuel_combustion", geographyCountry: place, inputUnit: unit, co2e, biogenicCo2: bio || null,
        usageNotes: `${label}. Combustion only (ADEME ${id}; with upstream ${total}${scale !== 1 ? ` per ${r["Unité français"].replace(/^kgCO2e\//i, "")}` : ""}).${unit === "kWh" ? " Per kWh gross CV (PCS)." : unit === "kWh_ncv" ? " Per kWh net CV (PCI)." : ""}${converted}`,
      };
      if (ncv || gcvGj || place !== "FR") {
        // One factor per fuel, place and unit: the per-kWh row wins over the
        // same factor restated per GJ, MJ or tep.
        const key = `${label}|${place}|${unit}`;
        const rank = ncv ? NCV_UNITS.indexOf(ncv) : gcvGj ? 1 : 0;
        const prev = extraFuels.get(key);
        if (prev && prev.rank <= rank) { skip("fuel: same factor in another unit"); continue; }
        if (prev) skip("fuel: same factor in another unit");
        extraFuels.set(key, { rank, f: { ...f, externalId: `ademe-${id}`, categoryCode: "s1-stationary" } });
        continue;
      }
      directFuels.add(`${label}|${place}|${unit}`);
      push({ ...f, externalId: `ademe-${id}`, categoryCode: "s1-stationary" });
      if (unit === "litre") push({ ...f, externalId: `ademe-${id}-mobile`, categoryCode: "s1-mobile" });
      continue;
    }

    if (/Ratios monétaires/.test(cat)) {
      const year = Number(r["Unité français"].match(/keuro \((\d{4})\) HT/i)?.[1]);
      if (!year) { skip("spend: unit not per k€ of a stated year"); continue; }
      if (year !== spendYear) { skip(`spend: earlier year (${year})`); continue; }
      const naf = nafFromComment(r["Commentaire français"]);
      if (!naf) { skip("spend: no NAF division"); continue; }
      push({
        ...base, externalId: `ademe-${id}`, categoryCode: "s3-purchased-goods", activityType: `naf_${naf}`, geographyCountry: "FR",
        inputUnit: "EUR", co2e: total / 1000, priceBaseYear: year,
        usageNotes: `NAF ${naf}: ${label.replace(/\s*[–-]\s*\d{4}\b/g, "")}. ${total} kgCO2e per k€ ${year} excl. VAT (ADEME ${id}), so ${total / 1000} per EUR.`,
      });
      continue;
    }

    const mapped: Array<[RegExp, string, string]> = [
      [/^Traitement des déchets/, "s3-waste", "waste_treatment"],
      [/^Transport de personnes/, "s3-business-travel", "passenger_transport"],
      [/^Transport de marchandises/, "s3-upstream-transport", "freight_transport"],
      [/PRG à 100 ans/, "s1-fugitive", "refrigerant_gwp"],
      [/^Achats de biens > /, "s3-purchased-goods", "goods"],
    ];
    const hit = mapped.find(([re]) => re.test(cat));
    if (!hit) {
      skip(/^UTCF/.test(cat) ? "land use change (UTCF): per hectare, GHG Protocol Land Sector standard" : `category not mapped: ${cat.split(" > ")[0]}`);
      continue;
    }
    const [, categoryCode, activityType] = hit;
    const where = country !== undefined ? country : placeOf(r, false);
    if (where === undefined) { skip(`${activityType}: region without a country`); continue; }
    const unit = unitOf(r["Unité français"]);
    const allowed: Record<string, string[]> = {
      waste_treatment: ["tonne"], passenger_transport: ["passenger.km", "km"], freight_transport: ["tonne.km"],
      refrigerant_gwp: ["kg"], goods: ["kg", "tonne", "unit"],
    };
    if (!unit || !allowed[activityType].includes(unit)) { skip(`${activityType}: unit ${r["Unité français"] || "blank"}`); continue; }
    const transport = activityType.endsWith("_transport");
    push({
      ...base, externalId: `ademe-${id}`, categoryCode, activityType, geographyCountry: where, inputUnit: unit,
      co2e: transport ? withoutManufacture() : total,
      usageNotes: `${label} (ADEME ${id}${transport && ps.some((p) => /^Fabrication/i.test(p.type)) ? `; vehicle manufacture excluded, total ${total}` : ""}).`,
    });
  }

  for (const [key, { f }] of extraFuels) {
    if (directFuels.has(key)) { skip("fuel: same factor in another unit"); continue; }
    push(f);
    if (f.inputUnit === "litre") push({ ...f, externalId: `${f.externalId}-mobile`, categoryCode: "s1-mobile" });
  }

  // One grid factor per country: a country listed twice keeps its first row.
  const byCountry = new Map<string, AdemeFactor>();
  for (const f of otherGrid) {
    if (byCountry.has(f.geographyCountry!)) { skip("electricity: second row for the same country"); continue; }
    byCountry.set(f.geographyCountry!, f);
    push(f);
  }

  // The latest grid year stays in force until ADEME publishes the next one.
  const grid = factors.filter((f) => f.categoryCode === "s2-electricity-lb" && f.effectiveStart);
  const latest = grid.map((f) => f.effectiveStart!).sort().at(-1);
  for (const f of grid) if (f.effectiveStart === latest) f.effectiveEnd = null;

  const version = rows.map((r) => r["Date de modification"]).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1) ?? "unknown";
  return { factors, skipped, version, spendYear };
}

const q = (s: string | null) => (s == null ? "NULL" : `'${s.replace(/'/g, "''")}'`);
const n = (v: number | null) => (v == null ? "NULL" : String(Number(v.toPrecision(8))));

/** Additive, idempotent migration for the library and its factors. */
export function buildAdemeMigrationSql(build: AdemeBuild, sourceFile: string, alreadyLoaded = 0): string {
  const L = ADEME_LIBRARY;
  const version = build.version.slice(0, 7).replace("-", ".");
  const values = build.factors
    .map((f) => `    (${q(f.externalId)}, ${q(f.categoryCode)}, ${q(f.activityType)}, ${q(f.geographyCountry)}, ${q(f.inputUnit)}, ${n(f.co2e)}, ${n(f.biogenicCo2)}, ${f.priceBaseYear ?? "NULL"}, ${f.effectiveStart ? `DATE '${f.effectiveStart}'` : "NULL::date"}, ${f.effectiveEnd ? `DATE '${f.effectiveEnd}'` : "NULL::date"}, ${q(f.usageNotes)})`)
    .join(",\n");
  const skipped = Object.entries(build.skipped).sort((a, b) => b[1] - a[1]).map(([k, v]) => `--   ${v} ${k}`).join("\n");
  return `-- ADEME Base Carbone, export last modified ${build.version} (${build.factors.length} factors${alreadyLoaded ? `, in addition to ${alreadyLoaded} loaded by an earlier migration` : ""}).
-- Generated by scripts/build-ademe-factors.ts from ${sourceFile}. Do not edit by hand.
-- Licence Ouverte v2.0. Mapping and what is left out: lib/factors/ademe.ts.
-- Rows not loaded, by reason:
${skipped}
-- Additive: inserts only what is missing.

${build.factors.some((f) => f.categoryCode === "s2-heat") ? `INSERT INTO "emission_categories" ("id", "scope", "code", "name", "activity_type")
VALUES (gen_random_uuid()::text, 2, 's2-heat', 'Purchased Heat, Steam & Cooling', 'purchased_heat')
ON CONFLICT ("code") DO NOTHING;

` : ""}INSERT INTO "factor_libraries" ("id", "name", "version", "license", "source_url", "published_at", "created_at")
VALUES (gen_random_uuid()::text, ${q(L.name)}, ${q(version)}, ${q(L.license)}, ${q(L.sourceUrl)}, DATE ${q(build.version)}, now())
ON CONFLICT ("name", "version") DO NOTHING;

WITH lib AS (
  SELECT "id" FROM "factor_libraries" WHERE "name" = ${q(L.name)} AND "version" = ${q(version)}
), src ("external_id", "category_code", "activity_type", "geography_country", "input_unit", "co2e", "biogenic_co2", "price_base_year", "effective_start_date", "effective_end_date", "usage_notes") AS (
  VALUES
${values}
)
INSERT INTO "emission_factors" (
  "id", "factor_library_id", "external_id", "scope", "emission_category_id", "activity_type", "geography_country",
  "input_unit", "co2e", "biogenic_co2", "price_base_year", "effective_start_date", "effective_end_date", "usage_notes"
)
SELECT gen_random_uuid()::text, lib."id", src."external_id", c."scope", c."id", src."activity_type", src."geography_country",
       src."input_unit", src."co2e"::numeric, src."biogenic_co2"::numeric, src."price_base_year"::int, src."effective_start_date", src."effective_end_date", src."usage_notes"
FROM src
JOIN "emission_categories" c ON c."code" = src."category_code"
CROSS JOIN lib
WHERE NOT EXISTS (
  SELECT 1 FROM "emission_factors" e WHERE e."factor_library_id" = lib."id" AND e."external_id" = src."external_id"
);
`;
}
