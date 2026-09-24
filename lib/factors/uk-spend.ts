// Defra / University of Leeds spend-based emissions multipliers, published
// with "UK and England's carbon footprint to 2023" (30 June 2026, Open
// Government Licence v3.0). One multiplier per broad UK SIC 2007 product
// group and year: kg CO2e of full supply-chain emissions per £ spent, at that
// year's basic prices (excluding VAT). Defra notes they are for an initial
// assessment where an organisation has no activity data.
//
// Each year's multiplier is loaded as its own factor, effective for that
// calendar year with that year as its price year, so spend is priced at its
// own year's prices and needs no deflation. The earliest loaded year also
// covers earlier spend, and the latest stays open for later spend (deflated
// to its prices with UK CPI).
//
// Pure: parsing and SQL generation only. scripts/build-uk-spend-factors.ts
// reads data/sources/uk-spend-multipliers-sic-2015-2023.txt (extracted from
// the published .ods) and writes the migration.

export const UK_SPEND_LIBRARY = {
  name: "Defra UK spend multipliers",
  version: "2023",
  license: "Open Government Licence v3.0",
  sourceUrl: "https://www.gov.uk/government/statistics/uks-carbon-footprint",
  publishedAt: "2026-06-30",
} as const;

const pad2 = (n: string) => n.padStart(2, "0");

// Groups whose codes do not say which SIC classes they cover. The three
// construction groups are named by their product titles (buildings; civil
// engineering; specialised construction works = SIC divisions 41, 42, 43),
// and imputed rent is never a supplier's industry.
const SPECIAL: Record<string, string[]> = {
  "20A": ["2011", "2013", "2015"],
  "20B": ["2014", "2016", "2017", "2060"],
  "20C": ["2012", "2020"],
  "23OTHER": ["231", "232", "233", "234", "237", "238", "239"],
  "25OTHER": ["251", "252", "253", "255", "256", "257", "258", "259"],
  "30OTHER": ["302", "304", "309"],
  "33OTHER": ["3311", "3312", "3313", "3314", "3317", "3319", "332"],
  "41.2": ["41"],
  "42.1-2": ["42"],
  "42.99": ["43"],
  "68.12": ["681", "682"],
  "68.2IMP": [],
};

/** Group key used in activityType "uksic_<key>": the code without spaces. */
export const groupKey = (code: string) => code.replace(/\s+/g, "");

/**
 * The SIC 2007 code prefixes (digits only) a group covers: "10.2 -3" is
 * 102 and 103, "11.01-6" is 1101 to 1106, "46" is the whole division.
 */
export function groupPrefixes(code: string): string[] {
  const key = groupKey(code);
  if (key in SPECIAL) return SPECIAL[key];
  const m = key.match(/^(\d{1,2})(?:\.(\d+)(?:-(\d+))?)?$/);
  if (!m) throw new Error(`Unrecognised SIC group code "${code}".`);
  const div = pad2(m[1]);
  if (!m[2]) return [div];
  if (!m[3]) return [div + m[2]];
  const width = m[3].length;
  const head = m[2].slice(0, m[2].length - width);
  const out: string[] = [];
  for (let n = Number(m[2].slice(-width)); n <= Number(m[3]); n++) out.push(div + head + String(n).padStart(width, "0"));
  return out;
}

export type UkSpendGroup = { code: string; title: string; values: Record<number, number> };

/** Reads the extract: comment lines, then `code|title|v2015|...|v2023`. */
export function parseUkSpendExtract(text: string): { years: number[]; groups: UkSpendGroup[] } {
  const lines = text.split(/\r?\n/);
  const header = lines.find((l) => /^# Columns:/.test(l));
  const years = (header?.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
  if (years.length === 0) throw new Error("No year columns in the extract header.");
  const groups: UkSpendGroup[] = [];
  const seen = new Set<string>();
  for (const [i, line] of lines.entries()) {
    if (!line.trim() || line.startsWith("#")) continue;
    const parts = line.split("|");
    if (parts.length !== years.length + 2) throw new Error(`Line ${i + 1}: expected ${years.length + 2} fields, got ${parts.length}.`);
    const [code, title, ...vals] = parts;
    if (seen.has(code)) throw new Error(`Line ${i + 1}: SIC group ${code} appears twice.`);
    seen.add(code);
    groupPrefixes(code); // validates the code
    const values: Record<number, number> = {};
    vals.forEach((v, j) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new Error(`Line ${i + 1}: ${years[j]} value "${v}" is not a number.`);
      values[years[j]] = n;
    });
    groups.push({ code, title: title.trim(), values });
  }
  return { years, groups };
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Additive, idempotent migration: the library and one factor per group and year. */
export function buildUkSpendMigrationSql(data: { years: number[]; groups: UkSpendGroup[] }, sourceFile: string): string {
  const L = UK_SPEND_LIBRARY;
  const first = Math.min(...data.years);
  const last = Math.max(...data.years);
  const rows: string[] = [];
  for (const g of data.groups) {
    if (groupPrefixes(g.code).length === 0) continue;
    const key = groupKey(g.code);
    for (const y of data.years) {
      const start = y === first ? "NULL::date" : `DATE '${y}-01-01'`;
      const end = y === last ? "NULL::date" : `DATE '${y}-12-31'`;
      const notes = `UK SIC ${g.code}: ${g.title}. ${y} multiplier, kg CO2e per £ at ${y} basic prices excl. VAT, full supply chain (Defra/University of Leeds, UK carbon footprint to 2023).`;
      rows.push(`    (${q(`uk-spend-sic-${key}-${y}`)}, ${q(`uksic_${key}`)}, ${g.values[y]}, ${y}, ${start}, ${end}, ${q(notes)})`);
    }
  }
  return `-- ${L.name} ${L.version}: ${rows.length} factors (${data.groups.length} UK SIC groups x ${first}-${last}).
-- Generated by scripts/build-uk-spend-factors.ts from ${sourceFile}. Do not edit by hand.
-- Each year's multiplier is effective for that year at its own prices; ${first} also covers
-- earlier spend and ${last} later spend. Imputed rent (68.2IMP) is not loaded.
-- Additive: inserts only what is missing.

INSERT INTO "factor_libraries" ("id", "name", "version", "license", "source_url", "published_at", "created_at")
VALUES (gen_random_uuid()::text, ${q(L.name)}, ${q(L.version)}, ${q(L.license)}, ${q(L.sourceUrl)}, DATE ${q(L.publishedAt)}, now())
ON CONFLICT ("name", "version") DO NOTHING;

WITH lib AS (
  SELECT "id" FROM "factor_libraries" WHERE "name" = ${q(L.name)} AND "version" = ${q(L.version)}
), src ("external_id", "activity_type", "co2e", "price_base_year", "effective_start_date", "effective_end_date", "usage_notes") AS (
  VALUES
${rows.join(",\n")}
)
INSERT INTO "emission_factors" (
  "id", "factor_library_id", "external_id", "scope", "emission_category_id", "activity_type", "geography_country",
  "input_unit", "co2e", "uncertainty_rating", "usage_notes", "price_base_year", "effective_start_date", "effective_end_date"
)
SELECT gen_random_uuid()::text, lib."id", src."external_id", c."scope", c."id", src."activity_type", 'GB',
       'GBP', src."co2e", 'high', src."usage_notes", src."price_base_year", src."effective_start_date", src."effective_end_date"
FROM src
JOIN "emission_categories" c ON c."code" = 's3-purchased-goods'
CROSS JOIN lib
WHERE NOT EXISTS (
  SELECT 1 FROM "emission_factors" e WHERE e."factor_library_id" = lib."id" AND e."external_id" = src."external_id"
);
`;
}
