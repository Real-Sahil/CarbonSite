/**
 * DEFRA/DESNZ Greenhouse Gas Conversion Factors downloader and seeder.
 *
 * Published at: https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026
 * Licence: Open Government Licence v3.0
 * Auth: None (public GOV.UK assets, no API key)
 *
 * DEFRA publishes conversion factors annually as an Excel workbook.
 * The direct download URL for each year follows a stable pattern on
 * assets.publishing.service.gov.uk. Each workbook contains multiple
 * sheets: fuels, electricity, transport, waste, and business travel.
 *
 * This module defines:
 *   1. Types for parsed factor rows
 *   2. `downloadFactorWorkbook()` — fetches the raw workbook bytes
 *   3. `parseFactorRows()` — typed parser (requires xlsx npm package)
 *   4. Known direct download URLs for the 2024–2026 workbooks
 *
 * Typical usage (admin seed route, not end-user request path):
 *   const wb = await downloadFactorWorkbook(DEFRA_URLS["2026"]);
 *   const rows = parseFactorRows(wb);
 *   await upsertFactors(rows);
 */

import { DataSourceResult, OGL_V3, govFetch } from "./types";

/** A parsed DEFRA conversion factor row */
export interface DefraFactorRow {
  /** Category / fuel type, e.g. "Diesel (100% mineral)", "Grid electricity" */
  category: string;
  /** Sub-category / unit name, e.g. "litres", "kWh" */
  unit: string;
  /** Total kg CO2e per unit (including CH4 and N2O WTT contribution) */
  kgCo2ePerUnit: number;
  /** CO2 component only, kg per unit */
  kgCo2PerUnit?: number;
  /** CH4 component, kg per unit */
  kgCh4PerUnit?: number;
  /** N2O component, kg per unit */
  kgN2oPerUnit?: number;
  /** "Outside Scope" or a Scope string for the factor */
  scope?: string;
  /** Year of the DEFRA publication */
  year: number;
  /** Source sheet name within the workbook */
  sheet: string;
}

/** Direct download URLs for recent DEFRA factor workbooks.
 *  Keys are publication years. URLs point to the main conversion-factors
 *  Excel file on assets.publishing.service.gov.uk. Verify and update each
 *  year when DEFRA publishes the new edition (typically June/July). */
export const DEFRA_WORKBOOK_URLS: Record<string, string> = {
  "2026": "https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/conversion-factors-2026-condensed-set-flat-format.xlsx",
  "2025": "https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/conversion-factors-2025-condensed-set-flat-format.xlsx",
  "2024": "https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/conversion-factors-2024-condensed-set-flat-format.xlsx",
};

/** Sheet names within the DEFRA workbook that contain factor data */
export const DEFRA_SHEETS = [
  "Fuels",
  "UK electricity",
  "WTT- fuels",
  "WTT- UK & overseas electricity",
  "Material use",
  "Waste disposal",
  "Business travel- air",
  "Business travel- land",
  "Business travel- sea",
  "Freighting goods",
  "Hotel stays",
  "Transmission and distribution",
] as const;

/**
 * Download the DEFRA conversion factors workbook bytes.
 * Returns the raw ArrayBuffer for subsequent parsing with xlsx.
 * Wrapped in DataSourceResult to carry provenance metadata.
 */
export async function downloadFactorWorkbook(
  year: string | number = "2026",
): Promise<DataSourceResult<ArrayBuffer>> {
  const url = DEFRA_WORKBOOK_URLS[String(year)];
  if (!url) throw new Error(`No known DEFRA workbook URL for year ${year}`);

  const resp = await govFetch(url, 60_000);
  if (!resp.ok) throw new Error(`DEFRA workbook download ${resp.status}: ${url}`);

  const buffer = await resp.arrayBuffer();
  return {
    data: buffer,
    meta: {
      ...OGL_V3,
      source: `DEFRA/DESNZ GHG Conversion Factors ${year}`,
      version: `DEFRA ${year}.1`,
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/**
 * Parse factor rows from a DEFRA workbook buffer.
 * Requires the `xlsx` npm package (already a project dependency).
 *
 * The condensed "flat format" workbook has columns:
 *   Scope | Level 1 | Level 2 | Level 3 | Level 4 | Column Text | UOM |
 *   GHG/Unit | kg CO2e | kg CO2 | kg CH4 | kg N2O | Biogenic CO2
 *
 * @param buffer  ArrayBuffer returned by downloadFactorWorkbook()
 * @param year    Publication year (embedded in each row for traceability)
 */
export function parseFactorRows(buffer: ArrayBuffer, year: number): DefraFactorRow[] {
  // Dynamic import to avoid loading xlsx at module initialisation time.
  // This function is only called from admin seed routes / workers,
  // never on the request path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });

  const rows: DefraFactorRow[] = [];

  for (const sheetName of DEFRA_SHEETS) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: true,
      defval: null,
    });

    for (const row of data) {
      // Skip header rows and non-numeric entries
      const kgCo2e = Number(row["kg CO2e"] ?? row["GHG/unit"] ?? row["kg CO2e per unit"] ?? NaN);
      if (isNaN(kgCo2e) || kgCo2e === 0) continue;

      const category = [
        row["Level 1"],
        row["Level 2"],
        row["Level 3"],
        row["Level 4"],
      ]
        .filter(Boolean)
        .join(" > ");

      const unit = String(row["UOM"] ?? row["Unit"] ?? row["Column Text"] ?? "");

      rows.push({
        category: category || String(row["Activity"] ?? ""),
        unit,
        kgCo2ePerUnit: kgCo2e,
        kgCo2PerUnit: Number(row["kg CO2"] ?? NaN) || undefined,
        kgCh4PerUnit: Number(row["kg CH4"] ?? NaN) || undefined,
        kgN2oPerUnit: Number(row["kg N2O"] ?? NaN) || undefined,
        scope: row["Scope"] as string | undefined,
        year,
        sheet: sheetName,
      });
    }
  }

  return rows;
}
