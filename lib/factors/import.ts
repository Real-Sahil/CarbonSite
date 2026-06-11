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
};

const REQUIRED_HEADERS = ["scope", "input_unit"];
const FACTOR_VALUE_HEADERS = ["co2e", "co2", "ch4", "n2o"];
const MAX_FACTOR_ROWS = 5000;

export function parseFactorWorkbook(
  buffer: Buffer,
  filename: string,
  categories: FactorCategory[],
): FactorImportValidation {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { errors: ["Workbook does not contain any sheets."], rows: [] };

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    return { errors: [`${filename} does not contain any factor rows.`], rows: [] };
  }

  if (rawRows.length > MAX_FACTOR_ROWS) {
    return {
      errors: [`Factor imports are limited to ${MAX_FACTOR_ROWS} rows per upload.`],
      rows: [],
    };
  }

  const categoryByCode = new Map(
    categories.map((category) => [normalizeCell(category.code).toLowerCase(), category]),
  );
  const errors: string[] = [];
  const parsedRows: ParsedFactorRow[] = [];
  const seenExternalIds = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = normalizeHeaders(rawRow);
    const missing = REQUIRED_HEADERS.filter((header) => !normalizeCell(row[header]));
    if (missing.length > 0) {
      errors.push(`Row ${rowNumber}: missing required columns ${missing.join(", ")}.`);
      return;
    }

    const scope = Number.parseInt(normalizeCell(row.scope), 10);
    if (![1, 2, 3].includes(scope)) {
      errors.push(`Row ${rowNumber}: scope must be 1, 2, or 3.`);
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

  return { errors, rows: errors.length > 0 ? [] : parsedRows };
}

function normalizeHeaders(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim().toLowerCase().replaceAll(" ", "_"),
      value,
    ]),
  );
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
