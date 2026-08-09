import { Decimal } from "@prisma/client/runtime/library";
import * as XLSX from "xlsx";

export type FactorCategory = {
  activityType: string | null;
  code: string;
  id: string;
  scope: number;
};

export type ParsedFactorRow = {
  activityType: string | null;
  ch4: Decimal | null;
  co2: Decimal | null;
  co2e: Decimal | null;
  effectiveEndDate: Date | null;
  effectiveStartDate: Date | null;
  emissionCategoryId: string | null;
  externalId: string | null;
  geographyCountry: string | null;
  geographyRegion: string | null;
  inputUnit: string;
  n2o: Decimal | null;
  scope: number;
  uncertaintyRating: string | null;
  usageNotes: string | null;
};

export type FactorImportValidation = {
  errors: string[];
  rows: ParsedFactorRow[];
  columnRemap: Record<string, string>;
};

const REQUIRED_HEADERS = ["scope", "input_unit"];
const FACTOR_VALUE_HEADERS = ["co2e", "co2", "ch4", "n2o"];
const MAX_FACTOR_ROWS = 5000;

// Synonym dictionaries — maps alternate column names to canonical ones.
const COLUMN_SYNONYMS: Record<string, string[]> = {
  scope: ["ghg_scope", "scope_category", "scope_1_2_3", "emission_scope", "ghg_category", "scope_no", "ghg_scope_no", "category_scope"],
  input_unit: ["unit", "uom", "units", "measurement_unit", "unit_of_measure", "input_uom", "activity_unit", "measure", "base_unit"],
  co2e: ["co2_e", "co2e_factor", "kgco2e", "kg_co2e", "ghg_factor", "emission_factor", "total_co2e", "co2_equivalent", "kgco2e_factor"],
  co2: ["co2_factor", "carbon_dioxide", "carbon_dioxide_factor", "co2_kg"],
  ch4: ["methane", "ch4_factor", "methane_factor", "ch4_kg"],
  n2o: ["nitrous_oxide", "n2o_factor", "nitrous_oxide_factor", "n2o_kg"],
  emission_category_code: ["category", "category_code", "activity_category", "ghg_category_code", "scope_category_code", "emission_category"],
  activity_type: ["activity", "activity_name", "fuel_type", "fuel", "source_type"],
  geography_country: ["country", "country_code", "nation", "geography"],
  geography_region: ["region", "state", "province", "area"],
  effective_start_date: ["start_date", "valid_from", "effective_from", "date_from"],
  effective_end_date: ["end_date", "valid_to", "effective_to", "date_to", "expiry_date"],
  uncertainty_rating: ["uncertainty", "confidence", "rating"],
  external_id: ["id", "factor_id", "ref", "reference", "external_ref"],
};

// Build reverse lookup: synonym → canonical header name.
function buildSynonymIndex(synonyms: Record<string, string[]>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(synonyms)) {
    index.set(canonical, canonical); // canonical maps to itself
    for (const alias of aliases) {
      if (!index.has(alias)) index.set(alias, canonical);
    }
  }
  return index;
}

const SYNONYM_INDEX = buildSynonymIndex(COLUMN_SYNONYMS);

// Given the normalized headers from a file, build a remap from actual header → canonical header.
function detectFactorColumnRemap(normalizedKeys: string[]): Record<string, string> {
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

// Try to infer scope (1/2/3) from the emission category code in the row.
function inferScopeFromCategory(categoryCode: string, categoryByCode: Map<string, FactorCategory>): number | null {
  if (!categoryCode) return null;
  const category = categoryByCode.get(categoryCode.toLowerCase());
  if (category) return category.scope;
  // Fallback: check "s1-", "s2-", "s3-" prefixes
  const prefix = categoryCode.toLowerCase().slice(0, 3);
  if (prefix === "s1-") return 1;
  if (prefix === "s2-") return 2;
  if (prefix === "s3-") return 3;
  return null;
}

export function parseFactorWorkbook(
  buffer: Buffer,
  filename: string,
  categories: FactorCategory[],
): FactorImportValidation {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { errors: ["Workbook does not contain any sheets."], rows: [], columnRemap: {} };

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    return { errors: [`${filename} does not contain any factor rows.`], rows: [], columnRemap: {} };
  }

  if (rawRows.length > MAX_FACTOR_ROWS) {
    return {
      errors: [`Factor imports are limited to ${MAX_FACTOR_ROWS} rows per upload.`],
      rows: [],
      columnRemap: {},
    };
  }

  // Detect column remapping from the file's actual headers (once, before the loop).
  const firstNormalized = normalizeHeaders(rawRows[0]);
  const columnRemap = detectFactorColumnRemap(Object.keys(firstNormalized));

  const categoryByCode = new Map(
    categories.map((category) => [normalizeCell(category.code).toLowerCase(), category]),
  );
  const errors: string[] = [];
  const parsedRows: ParsedFactorRow[] = [];
  const seenExternalIds = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = applyColumnRemap(normalizeHeaders(rawRow), columnRemap);

    // Attempt scope inference if missing.
    let scopeRaw = normalizeCell(row.scope);
    if (!scopeRaw) {
      const categoryCode = normalizeCell(row.emission_category_code);
      const inferred = inferScopeFromCategory(categoryCode, categoryByCode);
      if (inferred !== null) scopeRaw = String(inferred);
    }

    const missing = REQUIRED_HEADERS.filter((header) => {
      if (header === "scope") return !scopeRaw;
      return !normalizeCell(row[header]);
    });
    if (missing.length > 0) {
      errors.push(`Row ${rowNumber}: missing required columns ${missing.join(", ")}.`);
      return;
    }

    const scope = Number.parseInt(scopeRaw, 10);
    if (![1, 2, 3].includes(scope)) {
      errors.push(`Row ${rowNumber}: scope must be 1, 2, or 3 (got "${scopeRaw}").`);
      return;
    }

    const inputUnit = normalizeCell(row.input_unit);
    if (inputUnit.length > 32) {
      errors.push(`Row ${rowNumber}: input_unit must be 32 characters or fewer.`);
      return;
    }

    const values = {
      ch4: parseDecimal(row.ch4),
      co2: parseDecimal(row.co2),
      co2e: parseDecimal(row.co2e),
      n2o: parseDecimal(row.n2o),
    };
    if (FACTOR_VALUE_HEADERS.every((header) => values[header as keyof typeof values] == null)) {
      errors.push(`Row ${rowNumber}: provide at least one factor value: co2e, co2, ch4, or n2o.`);
      return;
    }

    const invalidValue = FACTOR_VALUE_HEADERS.find((header) => {
      const value = normalizeCell(row[header]);
      return value && values[header as keyof typeof values] == null;
    });
    if (invalidValue) {
      errors.push(`Row ${rowNumber}: ${invalidValue} must be a valid number.`);
      return;
    }

    const categoryCode = normalizeCell(row.emission_category_code);
    const category = categoryCode ? categoryByCode.get(categoryCode.toLowerCase()) : null;
    if (categoryCode && !category) {
      errors.push(`Row ${rowNumber}: unknown emission_category_code "${categoryCode}".`);
      return;
    }
    if (category && category.scope !== scope) {
      errors.push(`Row ${rowNumber}: category ${category.code} is scope ${category.scope}, not scope ${scope}.`);
      return;
    }

    const externalId = nullableText(row.external_id, 120);
    if (externalId) {
      const key = externalId.toLowerCase();
      if (seenExternalIds.has(key)) {
        errors.push(`Row ${rowNumber}: duplicate external_id "${externalId}" in upload.`);
        return;
      }
      seenExternalIds.add(key);
    }

    const effectiveStartDate = parseOptionalDate(row.effective_start_date);
    const effectiveEndDate = parseOptionalDate(row.effective_end_date);
    if (effectiveStartDate === "invalid" || effectiveEndDate === "invalid") {
      errors.push(`Row ${rowNumber}: effective dates must be YYYY-MM-DD.`);
      return;
    }
    if (effectiveStartDate && effectiveEndDate && effectiveStartDate > effectiveEndDate) {
      errors.push(`Row ${rowNumber}: effective_start_date must be before effective_end_date.`);
      return;
    }

    parsedRows.push({
      activityType: nullableText(row.activity_type, 120) ?? category?.activityType ?? null,
      ch4: values.ch4,
      co2: values.co2,
      co2e: values.co2e,
      effectiveEndDate,
      effectiveStartDate,
      emissionCategoryId: category?.id ?? null,
      externalId,
      geographyCountry: nullableText(row.geography_country, 80),
      geographyRegion: nullableText(row.geography_region, 80),
      inputUnit,
      n2o: values.n2o,
      scope,
      uncertaintyRating: nullableText(row.uncertainty_rating, 80),
      usageNotes: nullableText(row.usage_notes, 500),
    });
  });

  return { errors, rows: errors.length > 0 ? [] : parsedRows, columnRemap };
}

function normalizeHeaders(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim().toLowerCase().replaceAll(" ", "_"),
      value,
    ]),
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

function parseDecimal(value: unknown) {
  const normalized = normalizeCell(value);
  if (!normalized) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return new Decimal(normalized);
}

function parseOptionalDate(value: unknown): Date | null | "invalid" {
  const normalized = normalizeCell(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "invalid";
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}
