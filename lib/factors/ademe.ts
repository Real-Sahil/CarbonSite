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
      const year = r["Nom attribut français"].match(/^(\d{4}) - mix moyen$/)?.[1];
      if (geo !== "France continentale" || !year || r["Nom frontière français"] !== "consommation") { skip("electricity: not the France annual average mix"); continue; }
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

    if (/^Combustibles > (Fossiles|Organiques)/.test(cat)) {
      const unit = unitOf(r["Unité français"]);
      if (geo !== "France continentale") { skip("fuel: outside mainland France"); continue; }
      if (!unit) { skip("fuel: net CV (PCI), GJ, MJ or tep unit"); continue; }
      const comb = ps.filter((p) => /^Combustion/i.test(p.type));
      if (!comb.length) { skip("fuel: no combustion post"); continue; }
      const co2e = comb.reduce((t, p) => t + (p.total ?? 0), 0);
      const bio = comb.reduce((t, p) => t + (p.co2b ?? 0), 0) || num(r["CO2b"]);
      const f = {
        ...base, activityType: "fuel_combustion", geographyCountry: "FR", inputUnit: unit, co2e, biogenicCo2: bio || null,
        usageNotes: `${label}. Combustion only (ADEME ${id}; with upstream ${total}).${unit === "kWh" ? " Per kWh gross CV (PCS)." : ""}`,
      };
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
    if (!hit) { skip(`category not mapped: ${cat.split(" > ")[0]}`); continue; }
    const [, categoryCode, activityType] = hit;
    if (country === undefined) { skip(`${activityType}: outside mainland France`); continue; }
    const unit = unitOf(r["Unité français"]);
    const allowed: Record<string, string[]> = {
      waste_treatment: ["tonne"], passenger_transport: ["passenger.km", "km"], freight_transport: ["tonne.km"],
      refrigerant_gwp: ["kg"], goods: ["kg", "tonne", "unit"],
    };
    if (!unit || !allowed[activityType].includes(unit)) { skip(`${activityType}: unit ${r["Unité français"] || "blank"}`); continue; }
    const transport = activityType.endsWith("_transport");
    push({
      ...base, externalId: `ademe-${id}`, categoryCode, activityType, geographyCountry: country, inputUnit: unit,
      co2e: transport ? withoutManufacture() : total,
      usageNotes: `${label} (ADEME ${id}${transport && ps.some((p) => /^Fabrication/i.test(p.type)) ? `; vehicle manufacture excluded, total ${total}` : ""}).`,
    });
  }

  // The latest grid year stays in force until ADEME publishes the next one.
  const grid = factors.filter((f) => f.categoryCode === "s2-electricity-lb");
  const latest = grid.map((f) => f.effectiveStart!).sort().at(-1);
  for (const f of grid) if (f.effectiveStart === latest) f.effectiveEnd = null;

  const version = rows.map((r) => r["Date de modification"]).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1) ?? "unknown";
  return { factors, skipped, version, spendYear };
}

const q = (s: string | null) => (s == null ? "NULL" : `'${s.replace(/'/g, "''")}'`);
const n = (v: number | null) => (v == null ? "NULL" : String(Number(v.toPrecision(8))));

/** Additive, idempotent migration for the library and its factors. */
export function buildAdemeMigrationSql(build: AdemeBuild, sourceFile: string): string {
  const L = ADEME_LIBRARY;
  const version = build.version.slice(0, 7).replace("-", ".");
  const values = build.factors
    .map((f) => `    (${q(f.externalId)}, ${q(f.categoryCode)}, ${q(f.activityType)}, ${q(f.geographyCountry)}, ${q(f.inputUnit)}, ${n(f.co2e)}, ${n(f.biogenicCo2)}, ${f.priceBaseYear ?? "NULL"}, ${f.effectiveStart ? `DATE '${f.effectiveStart}'` : "NULL::date"}, ${f.effectiveEnd ? `DATE '${f.effectiveEnd}'` : "NULL::date"}, ${q(f.usageNotes)})`)
    .join(",\n");
  const skipped = Object.entries(build.skipped).sort((a, b) => b[1] - a[1]).map(([k, v]) => `--   ${v} ${k}`).join("\n");
  return `-- ADEME Base Carbone, export last modified ${build.version} (${build.factors.length} factors).
-- Generated by scripts/build-ademe-factors.ts from ${sourceFile}. Do not edit by hand.
-- Licence Ouverte v2.0. Mapping and what is left out: lib/factors/ademe.ts.
-- Rows not loaded, by reason:
${skipped}
-- Additive: inserts only what is missing.

INSERT INTO "factor_libraries" ("id", "name", "version", "license", "source_url", "published_at", "created_at")
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
       src."input_unit", src."co2e", src."biogenic_co2", src."price_base_year", src."effective_start_date", src."effective_end_date", src."usage_notes"
FROM src
JOIN "emission_categories" c ON c."code" = src."category_code"
CROSS JOIN lib
WHERE NOT EXISTS (
  SELECT 1 FROM "emission_factors" e WHERE e."factor_library_id" = lib."id" AND e."external_id" = src."external_id"
);
`;
}
