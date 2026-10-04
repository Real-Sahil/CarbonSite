// Canada's electricity consumption intensity by province and territory, from
// Annex 7 of the National Inventory Report 1990-2024 (Environment and Climate
// Change Canada), into the "ECCC" 2024 library.
//
// Source workbook: EN_Annex7_Electricity_Intensity.xlsx, Open Government
// Licence - Canada. One sheet per jurisdiction (Table A7-1 is Canada). The row
// "Consumption Intensity (g CO2 eq / kWh)" is the location-based factor for
// electricity consumed (it includes losses and SF6 from equipment). Years run
// across the columns; each year becomes a factor effective for that calendar
// year, the earliest loaded year open to the past and the latest open to the
// future until the next edition. The latest year is preliminary (the sheet's
// note a); the next National Inventory Report revises it.
//
// This library carries electricity only. Everything else on a run priced from
// it falls back to the DEFRA set (lib/calculation/library-fallback.ts).
// A province's row is picked only when the record or its facility names it
// (lib/calculation/regional-grid.ts); otherwise the national row applies.

import { assertUnique, round, slug, type NationalFactor } from "./national-load";

type Row = unknown[];
export type EcccSheets = Record<string, Row[]>;

const cell = (r: Row, i: number) => (r[i] == null ? "" : String(r[i]).replace(/\s+/g, " ").trim());

const PLACES: [RegExp, string, string][] = [
  [/for Canada$/i, "national", "Canada"],
  [/Newfoundland and Labrador/i, "nl", "Newfoundland and Labrador"],
  [/Prince Edward Island/i, "pe", "Prince Edward Island"],
  [/Nova Scotia/i, "ns", "Nova Scotia"],
  [/New Brunswick/i, "nb", "New Brunswick"],
  [/Quebec/i, "qc", "Quebec"],
  [/Ontario/i, "on", "Ontario"],
  [/Manitoba/i, "mb", "Manitoba"],
  [/Saskatchewan/i, "sk", "Saskatchewan"],
  [/Alberta/i, "ab", "Alberta"],
  [/British Columbia/i, "bc", "British Columbia"],
  [/Yukon/i, "yt", "Yukon"],
  [/Northwest Territories/i, "nt", "Northwest Territories"],
  [/Nunavut/i, "nu", "Nunavut"],
];

const SRC = "National Inventory Report 1990-2024, Annex 7, Environment and Climate Change Canada, Open Government Licence - Canada";

export function placeOf(title: string): { code: string; name: string } {
  const hit = PLACES.find(([re]) => re.test(title));
  if (!hit) throw new Error(`ECCC: unknown place in "${title}"`);
  return { code: hit[1], name: hit[2] };
}

/** A year header cell: 2019, "2019" or "2024a" (a footnote letter follows the preliminary year). */
const yearOf = (c: unknown): number | null => {
  const m = String(c ?? "").trim().match(/^(\d{4})[a-z]?$/);
  const y = m ? Number(m[1]) : NaN;
  return y >= 1990 && y < 2100 ? y : null;
};

/** One table sheet to its yearly consumption intensities, g CO2e per kWh. */
export function intensities(rows: Row[]): { title: string; byYear: Map<number, number> } {
  const title = cell(rows[0] ?? [], 1) || cell(rows[0] ?? [], 0);
  const header = rows.find((r) => r.filter((c) => yearOf(c) != null).length >= 3);
  if (!header) throw new Error(`ECCC: no year header in "${title}"`);
  const isLabel = (t: string) => /^Consumption Intensity \(g CO2 ?eq ?\/ ?kWh\)/i.test(t);
  const label = rows.find((r) => isLabel(cell(r, 0)) || isLabel(cell(r, 1)));
  if (!label) throw new Error(`ECCC: consumption intensity row not found in "${title}"`);
  const byYear = new Map<number, number>();
  header.forEach((h, i) => {
    const y = yearOf(h);
    const v = label[i];
    if (y != null && typeof v === "number" && Number.isFinite(v)) byYear.set(y, v);
  });
  return { title, byYear };
}

export function buildEcccFactors(sheets: EcccSheets, firstYear = 2019): NationalFactor[] {
  const out: NationalFactor[] = [];
  for (const [name, rows] of Object.entries(sheets)) {
    if (!/^Table A7.\d+$/.test(name.trim())) continue;
    const { title, byYear } = intensities(rows);
    const place = placeOf(title);
    const years = [...byYear.keys()].filter((y) => y >= firstYear).sort((a, b) => a - b);
    if (!years.length) throw new Error(`ECCC: no years from ${firstYear} for ${place.name}`);
    const last = years[years.length - 1];
    for (const y of years) {
      const national = place.code === "national";
      out.push({
        externalId: `eccc-nir2024-elec-${place.code}-${y}`,
        scope: 2,
        categoryCode: "s2-electricity-lb",
        activityType: national ? "purchased_electricity_location" : `grid_ca_${place.code}`,
        country: "CA",
        region: national ? null : place.name,
        unit: "kWh",
        co2e: round(byYear.get(y)! / 1000),
        effectiveStart: y === years[0] ? null : `${y}-01-01`,
        effectiveEnd: y === last ? null : `${y}-12-31`,
        notes: `${place.name}, ${y}: electricity consumption intensity, kg CO2e per kWh (g CO2 eq per kWh divided by 1,000), location-based Scope 2. ${y === last ? "Preliminary data in this edition; applied to later years until the next National Inventory Report. " : ""}Includes losses and SF6 from electrical equipment. ${SRC}.`,
      });
    }
  }
  if (!out.some((f) => f.region == null)) throw new Error("ECCC: national table not found");
  assertUnique(out);
  return out;
}

export { slug };
