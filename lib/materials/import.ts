// Bulk import/update for the embodied carbon material library
// (EmbodiedMaterial) — the shared, cross-tenant reference data consumed by
// lib/embodied-carbon/engine.ts. Mirrors lib/factors/import.ts: same
// synonym-remapping approach, same "collect every error before accepting
// any row" discipline, so a single typo in a 40-row upload doesn't
// half-apply.
//
// Unlike EmissionFactor (versioned per FactorLibrary, never edited in
// place), a material is keyed by its unique name and is meant to be
// corrected in place — re-importing the same name with a newer GWP figure,
// or with previously-missing C1-C4/replacement-cycle data, should update
// that row rather than create a duplicate.

import * as XLSX from "xlsx";

export type ParsedMaterialRow = {
  name: string;
  category: string;
  description: string | null;
  gwpA1A3: number;
  gwpA4: number | null;
  gwpA5: number | null;
  gwpC1C4: number | null;
  gwpC1: number | null;
  gwpC2: number | null;
  gwpC3: number | null;
  gwpC4: number | null;
  gwpD: number | null;
  replacementCycleYears: number | null;
  declaredUnit: string;
  density: number | null;
  source: string;
  sourceUrl: string | null;
};

export type MaterialImportValidation = {
  errors: string[];
  rows: ParsedMaterialRow[];
  columnRemap: Record<string, string>;
};

const REQUIRED_HEADERS = ["name", "category", "gwp_a1_a3"];
const OPTIONAL_GWP_HEADERS = ["gwp_a4", "gwp_a5", "gwp_c1_c4", "gwp_c1", "gwp_c2", "gwp_c3", "gwp_c4", "gwp_d"];
const VALID_DECLARED_UNITS = ["kg", "m3", "m2"];
const MAX_MATERIAL_ROWS = 2000;

const COLUMN_SYNONYMS: Record<string, string[]> = {
  name: ["material_name", "product_name", "material"],
  category: ["material_category", "group", "type"],
  description: ["notes", "desc"],
  gwp_a1_a3: ["a1_a3", "a1a3", "cradle_to_gate", "gwp_a1a3", "embodied_carbon"],
  gwp_a4: ["a4", "transport", "transport_to_site"],
  gwp_a5: ["a5", "installation"],
  gwp_c1_c4: ["c1_c4", "c1c4", "end_of_life", "eol", "gwp_eol"],
  gwp_c1: ["c1", "deconstruction", "demolition"],
  gwp_c2: ["c2", "waste_transport"],
  gwp_c3: ["c3", "waste_processing"],
  gwp_c4: ["c4", "disposal"],
  gwp_d: ["d", "beyond_boundary", "reuse_recycling", "module_d"],
  replacement_cycle_years: ["replacement_cycle", "replacement_years", "lifespan_years", "service_life", "replacement_cycle_yrs"],
  declared_unit: ["unit", "uom", "units"],
  density: ["density_kg_m3", "kg_per_m3", "density_kgm3"],
  source: ["data_source"],
  source_url: ["url", "reference_url", "link"],
};

function buildSynonymIndex(synonyms: Record<string, string[]>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(synonyms)) {
    index.set(canonical, canonical);
    for (const alias of aliases) {
      if (!index.has(alias)) index.set(alias, canonical);
    }
  }
  return index;
}

const SYNONYM_INDEX = buildSynonymIndex(COLUMN_SYNONYMS);

function detectColumnRemap(normalizedKeys: string[]): Record<string, string> {
  const remap: Record<string, string> = {};
  const usedCanonicals = new Set<string>();
  for (const key of normalizedKeys) {
    const canonical = SYNONYM_INDEX.get(key);
    if (canonical && canonical !== key && !usedCanonicals.has(canonical)) {
      remap[key] = canonical;
      usedCanonicals.add(canonical);
    }
  }
  return remap;
}

export function parseMaterialWorkbook(buffer: Buffer, filename: string): MaterialImportValidation {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { errors: ["Workbook does not contain any sheets."], rows: [], columnRemap: {} };

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

  if (rawRows.length === 0) {
    return { errors: [`${filename} does not contain any material rows.`], rows: [], columnRemap: {} };
  }
  if (rawRows.length > MAX_MATERIAL_ROWS) {
    return {
      errors: [`Material imports are limited to ${MAX_MATERIAL_ROWS} rows per upload.`],
      rows: [],
      columnRemap: {},
    };
  }

  const firstNormalized = normalizeHeaders(rawRows[0]);
  const columnRemap = detectColumnRemap(Object.keys(firstNormalized));

  const errors: string[] = [];
  const parsedRows: ParsedMaterialRow[] = [];
  const seenNames = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = applyColumnRemap(normalizeHeaders(rawRow), columnRemap);

    const missing = REQUIRED_HEADERS.filter((header) => !normalizeCell(row[header]));
    if (missing.length > 0) {
      errors.push(`Row ${rowNumber}: missing required columns ${missing.join(", ")}.`);
      return;
    }

    const name = normalizeCell(row.name).slice(0, 200);
    const key = name.toLowerCase();
    if (seenNames.has(key)) {
      errors.push(`Row ${rowNumber}: duplicate material name "${name}" in upload.`);
      return;
    }
    seenNames.add(key);

    const gwpA1A3 = parseNumber(row.gwp_a1_a3);
    if (gwpA1A3 == null) {
      errors.push(`Row ${rowNumber}: gwp_a1_a3 must be a valid number.`);
      return;
    }
    if (gwpA1A3 < 0) {
      errors.push(`Row ${rowNumber}: gwp_a1_a3 cannot be negative.`);
      return;
    }

    const gwpValues: Record<string, number | null> = {};
    let invalidGwpHeader: string | null = null;
    for (const header of OPTIONAL_GWP_HEADERS) {
      const raw = normalizeCell(row[header]);
      const value = parseNumber(row[header]);
      if (raw && value == null) {
        invalidGwpHeader = header;
        break;
      }
      gwpValues[header] = value;
    }
    if (invalidGwpHeader) {
      errors.push(`Row ${rowNumber}: ${invalidGwpHeader} must be a valid number.`);
      return;
    }

    const declaredUnitRaw = normalizeCell(row.declared_unit).toLowerCase();
    const declaredUnit = declaredUnitRaw || "kg";
    if (!VALID_DECLARED_UNITS.includes(declaredUnit)) {
      errors.push(`Row ${rowNumber}: declared_unit must be one of ${VALID_DECLARED_UNITS.join(", ")} (got "${declaredUnitRaw}").`);
      return;
    }

    const densityRaw = normalizeCell(row.density);
    const density = parseNumber(row.density);
    if (densityRaw && density == null) {
      errors.push(`Row ${rowNumber}: density must be a valid number.`);
      return;
    }
    if (density != null && density <= 0) {
      errors.push(`Row ${rowNumber}: density must be positive.`);
      return;
    }

    const replacementRaw = normalizeCell(row.replacement_cycle_years);
    const replacementCycleYears = parseWholeNumber(row.replacement_cycle_years);
    if (replacementRaw && replacementCycleYears == null) {
      errors.push(`Row ${rowNumber}: replacement_cycle_years must be a whole number.`);
      return;
    }
    if (replacementCycleYears != null && replacementCycleYears <= 0) {
      errors.push(`Row ${rowNumber}: replacement_cycle_years must be a positive whole number.`);
      return;
    }

    parsedRows.push({
      name,
      category: normalizeCell(row.category).slice(0, 80),
      description: nullableText(row.description, 2000),
      gwpA1A3,
      gwpA4: gwpValues.gwp_a4,
      gwpA5: gwpValues.gwp_a5,
      gwpC1C4: gwpValues.gwp_c1_c4,
      gwpC1: gwpValues.gwp_c1,
      gwpC2: gwpValues.gwp_c2,
      gwpC3: gwpValues.gwp_c3,
      gwpC4: gwpValues.gwp_c4,
      gwpD: gwpValues.gwp_d,
      replacementCycleYears,
      declaredUnit,
      density,
      source: nullableText(row.source, 200) ?? "ICE v3.0",
      sourceUrl: nullableText(row.source_url, 500),
    });
  });

  return { errors, rows: errors.length > 0 ? [] : parsedRows, columnRemap };
}

function normalizeHeaders(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim().toLowerCase().replaceAll(" ", "_"), value]),
  );
}

function applyColumnRemap(row: Record<string, unknown>, remap: Record<string, string>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[remap[key] ?? key] = value;
  }
  return result;
}

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown, maxLength: number) {
  const normalized = normalizeCell(value);
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function parseNumber(value: unknown): number | null {
  const normalized = normalizeCell(value);
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseWholeNumber(value: unknown): number | null {
  const number = parseNumber(value);
  if (number == null || !Number.isInteger(number)) return null;
  return number;
}
