import type { ParsedRow } from "./parser";

// ── Column → canonical field mapping ─────────────────────────────────────────

type FieldMapping = { canonical: string; aliases: string[] };

const FIELD_MAPPINGS: FieldMapping[] = [
  { canonical: "amount", aliases: ["amount", "quantity", "qty", "value", "volume"] },
  { canonical: "unit", aliases: ["unit", "uom", "units", "unit of measure"] },
  {
    canonical: "emissionCategoryCode",
    aliases: ["category", "category code", "emission category", "scope category", "category_code"],
  },
  {
    canonical: "activityDate",
    aliases: ["activity date", "date", "activity_date", "transaction date", "event date"],
  },
  { canonical: "startDate", aliases: ["start date", "start_date", "period start", "from date"] },
  { canonical: "endDate", aliases: ["end date", "end_date", "period end", "to date"] },
  {
    canonical: "sourceDescription",
    aliases: ["source", "description", "source description", "source_description", "notes", "detail"],
  },
  { canonical: "facilityName", aliases: ["facility", "facility name", "facility_name", "site", "location"] },
  { canonical: "businessUnitName", aliases: ["business unit", "business_unit", "department", "division"] },
  { canonical: "supplierName", aliases: ["supplier", "supplier name", "vendor", "contractor"] },
  { canonical: "country", aliases: ["country", "country code", "geography"] },
  { canonical: "region", aliases: ["region", "state", "province"] },
  { canonical: "fuelType", aliases: ["fuel type", "fuel_type", "fuel", "fuel source"] },
  { canonical: "transportMode", aliases: ["transport mode", "mode", "transport_mode", "vehicle type"] },
  { canonical: "refrigerantType", aliases: ["refrigerant", "refrigerant type", "gas type", "f-gas"] },
  { canonical: "distanceAmount", aliases: ["distance", "distance amount", "distance_amount", "km", "miles"] },
  { canonical: "distanceUnit", aliases: ["distance unit", "distance_unit"] },
  { canonical: "spendAmount", aliases: ["spend", "cost", "spend amount", "expenditure", "invoice amount"] },
  { canonical: "spendCurrency", aliases: ["currency", "spend currency", "ccy"] },
  {
    canonical: "scope2Method",
    aliases: ["scope 2 method", "scope2_method", "market/location based", "electricity method"],
  },
  { canonical: "assumptionNotes", aliases: ["assumptions", "assumption notes", "assumption_notes", "comments"] },
];

function buildAliasIndex(mappings: FieldMapping[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const { canonical, aliases } of mappings) {
    for (const alias of aliases) {
      index.set(alias.toLowerCase(), canonical);
    }
  }
  return index;
}

const ALIAS_INDEX = buildAliasIndex(FIELD_MAPPINGS);

export function mapColumns(headers: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const header of headers) {
    const canonical = ALIAS_INDEX.get(header.toLowerCase());
    if (canonical) result.set(header, canonical);
  }
  return result;
}

// ── Row validation ────────────────────────────────────────────────────────────

export type ValidationError = { field: string; message: string };
export type ValidatedRow = {
  data: Record<string, unknown>;
  errors: ValidationError[];
  warnings: ValidationError[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SCOPE2_METHODS = new Set(["location_based", "market_based", "location based", "market based"]);

export function validateRow(
  rawRow: ParsedRow,
  columnMap: Map<string, string>,
  categoryCodeIndex: Map<string, string>,
  facilityNameIndex: Map<string, string>,
  businessUnitNameIndex: Map<string, string>,
): ValidatedRow {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const data: Record<string, unknown> = {};

  // Build canonical field → value map
  const fields: Record<string, string> = {};
  for (const [header, canonical] of columnMap.entries()) {
    const val = rawRow[header];
    if (val !== undefined && val !== "") {
      fields[canonical] = val;
    }
  }

  // amount (required, positive number)
  const rawAmount = fields["amount"];
  if (!rawAmount) {
    errors.push({ field: "amount", message: "Amount is required." });
  } else {
    const num = parseFloat(rawAmount.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) {
      errors.push({ field: "amount", message: `"${rawAmount}" is not a positive number.` });
    } else {
      data.amount = num;
    }
  }

  // unit (required)
  const rawUnit = fields["unit"];
  if (!rawUnit) {
    errors.push({ field: "unit", message: "Unit is required." });
  } else {
    data.unit = rawUnit;
  }

  // emissionCategoryCode (required — resolve to ID)
  const rawCategory = fields["emissionCategoryCode"];
  if (!rawCategory) {
    errors.push({ field: "emissionCategoryCode", message: "Category code is required." });
  } else {
    const categoryId = categoryCodeIndex.get(rawCategory.toLowerCase());
    if (!categoryId) {
      errors.push({
        field: "emissionCategoryCode",
        message: `Unknown category code "${rawCategory}". Valid codes: ${[...categoryCodeIndex.keys()].join(", ")}.`,
      });
    } else {
      data.emissionCategoryId = categoryId;
    }
  }

  // activityDate (optional, must be YYYY-MM-DD if present)
  const rawDate = fields["activityDate"];
  if (rawDate) {
    if (!ISO_DATE.test(rawDate)) {
      errors.push({ field: "activityDate", message: `"${rawDate}" is not a valid YYYY-MM-DD date.` });
    } else {
      data.activityDate = rawDate;
    }
  }

  // startDate / endDate (optional)
  for (const field of ["startDate", "endDate"] as const) {
    const val = fields[field];
    if (val) {
      if (!ISO_DATE.test(val)) {
        errors.push({ field, message: `"${val}" is not a valid YYYY-MM-DD date.` });
      } else {
        data[field] = val;
      }
    }
  }

  // Pass-through string fields
  const stringFields = [
    "sourceDescription",
    "supplierName",
    "country",
    "region",
    "fuelType",
    "transportMode",
    "refrigerantType",
    "assumptionNotes",
  ];
  for (const field of stringFields) {
    if (fields[field]) data[field] = fields[field];
  }

  // facilityName → facilityId lookup
  const rawFacility = fields["facilityName"];
  if (rawFacility) {
    const facilityId = facilityNameIndex.get(rawFacility.toLowerCase());
    if (facilityId) {
      data.facilityId = facilityId;
    } else {
      warnings.push({ field: "facilityName", message: `Facility "${rawFacility}" not found; field will be blank.` });
    }
  }

  // businessUnitName → businessUnitId lookup
  const rawBusinessUnit = fields["businessUnitName"];
  if (rawBusinessUnit) {
    const buId = businessUnitNameIndex.get(rawBusinessUnit.toLowerCase());
    if (buId) {
      data.businessUnitId = buId;
    } else {
      warnings.push({
        field: "businessUnitName",
        message: `Business unit "${rawBusinessUnit}" not found; field will be blank.`,
      });
    }
  }

  // distanceAmount + distanceUnit
  const rawDistance = fields["distanceAmount"];
  if (rawDistance) {
    const num = parseFloat(rawDistance.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) {
      warnings.push({ field: "distanceAmount", message: `"${rawDistance}" is not a valid distance; skipped.` });
    } else {
      data.distanceAmount = num;
      if (fields["distanceUnit"]) data.distanceUnit = fields["distanceUnit"];
    }
  }

  // spendAmount + spendCurrency
  const rawSpend = fields["spendAmount"];
  if (rawSpend) {
    const num = parseFloat(rawSpend.replace(/,/g, ""));
    if (!isNaN(num) && num > 0) {
      data.spendAmount = num;
      if (fields["spendCurrency"]) data.spendCurrency = fields["spendCurrency"];
    } else {
      warnings.push({ field: "spendAmount", message: `"${rawSpend}" is not a valid spend amount; skipped.` });
    }
  }

  // scope2Method
  const rawScope2 = fields["scope2Method"];
  if (rawScope2) {
    if (SCOPE2_METHODS.has(rawScope2.toLowerCase())) {
      data.scope2Method = rawScope2.toLowerCase().replace(" ", "_");
    } else {
      warnings.push({
        field: "scope2Method",
        message: `"${rawScope2}" is not valid; use "location_based" or "market_based".`,
      });
    }
  }

  return { data, errors, warnings };
}

// ── Error CSV generator ───────────────────────────────────────────────────────

import * as XLSX from "xlsx";

export function buildErrorCsv(
  rows: { rowNumber: number; errors: ValidationError[]; warnings: ValidationError[] }[],
): Buffer {
  const errorRows = rows.flatMap(({ rowNumber, errors, warnings }) => [
    ...errors.map((e) => ({ Row: rowNumber, Severity: "Error", Field: e.field, Message: e.message })),
    ...warnings.map((w) => ({ Row: rowNumber, Severity: "Warning", Field: w.field, Message: w.message })),
  ]);

  if (errorRows.length === 0) return Buffer.alloc(0);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(errorRows);
  XLSX.utils.book_append_sheet(wb, ws, "Errors");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "csv" }));
}
