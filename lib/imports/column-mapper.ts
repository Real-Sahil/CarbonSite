// Shared column-mapping utilities for activity-record imports.
// Extends the core FIELD_MAPPINGS in validator.ts with inference and detection
// so the frontend can show a mapping review step before processing.

export type CanonicalField = {
  canonical: string;
  label: string;
  required: boolean;
  description: string;
};

export const CANONICAL_FIELDS: CanonicalField[] = [
  { canonical: "amount",              label: "Amount",              required: true,  description: "Numeric quantity of the activity" },
  { canonical: "unit",                label: "Unit",                required: true,  description: "Unit of measurement (e.g. kWh, litres, kg)" },
  { canonical: "emissionCategoryCode",label: "Category Code",       required: true,  description: "Emission category code (e.g. s1-mobile, s2-electricity-lb)" },
  { canonical: "activityDate",        label: "Activity Date",       required: false, description: "Date of the activity (YYYY-MM-DD)" },
  { canonical: "startDate",           label: "Start Date",          required: false, description: "Period start date (YYYY-MM-DD)" },
  { canonical: "endDate",             label: "End Date",            required: false, description: "Period end date (YYYY-MM-DD)" },
  { canonical: "sourceDescription",   label: "Description",         required: false, description: "Free-text description of the emission source" },
  { canonical: "facilityName",        label: "Facility",            required: false, description: "Name of the facility or site" },
  { canonical: "businessUnitName",    label: "Business Unit",       required: false, description: "Name of the department or business unit" },
  { canonical: "supplierName",        label: "Supplier",            required: false, description: "Supplier or contractor name" },
  { canonical: "country",             label: "Country",             required: false, description: "Country code or name" },
  { canonical: "region",              label: "Region",              required: false, description: "Region, state, or province" },
  { canonical: "fuelType",            label: "Fuel Type",           required: false, description: "Type of fuel (e.g. diesel, natural gas)" },
  { canonical: "transportMode",       label: "Transport Mode",      required: false, description: "Mode of transport (e.g. road, rail, air)" },
  { canonical: "refrigerantType",     label: "Refrigerant",         required: false, description: "Refrigerant or F-gas type" },
  { canonical: "distanceAmount",      label: "Distance",            required: false, description: "Distance travelled" },
  { canonical: "distanceUnit",        label: "Distance Unit",       required: false, description: "Unit of distance (km, miles)" },
  { canonical: "spendAmount",         label: "Spend Amount",        required: false, description: "Financial spend amount" },
  { canonical: "spendCurrency",       label: "Currency",            required: false, description: "Currency code (e.g. GBP, USD)" },
  { canonical: "scope2Method",        label: "Scope 2 Method",      required: false, description: "location_based or market_based" },
  { canonical: "assumptionNotes",     label: "Assumptions",         required: false, description: "Notes on assumptions or data quality" },
  { canonical: "dataOrigin",          label: "Data Origin",         required: false, description: "How the figure was obtained: metered, invoiced, supplier_specific, calculated, estimated, proxy or extrapolated" },
  { canonical: "dataOriginNote",      label: "Data Origin Note",    required: false, description: "Justification, required for proxy and extrapolated figures" },
];

// Extended synonym dictionary covering real-world column name variants.
const ACTIVITY_SYNONYMS: Record<string, string[]> = {
  amount: [
    "amount", "quantity", "qty", "value", "volume", "total", "usage", "consumption",
    "fuel_used", "electricity_used", "distance_travelled", "spend",
  ],
  unit: [
    "unit", "uom", "units", "unit_of_measure", "measurement_unit", "unit_type",
    "unit_name", "base_unit",
  ],
  emissionCategoryCode: [
    "category", "category_code", "emission_category", "scope_category",
    "category_code", "ghg_category", "emission_type", "scope_type",
    "scope_and_category", "activity_category",
  ],
  activityDate: [
    "activity_date", "date", "transaction_date", "event_date", "record_date",
    "invoice_date", "bill_date", "occurrence_date",
  ],
  startDate: [
    "start_date", "period_start", "from_date", "from", "date_from", "valid_from",
  ],
  endDate: [
    "end_date", "period_end", "to_date", "to", "date_to", "valid_to",
  ],
  sourceDescription: [
    "description", "source", "source_description", "notes", "detail", "memo",
    "narrative", "comment", "activity_description", "note",
  ],
  facilityName: [
    "facility", "facility_name", "site", "location", "premises", "building",
    "office", "plant", "depot",
  ],
  businessUnitName: [
    "business_unit", "department", "division", "team", "cost_centre", "cost_center",
    "bu", "org_unit",
  ],
  supplierName: [
    "supplier", "supplier_name", "vendor", "contractor", "provider",
    "third_party", "partner",
  ],
  country: [
    "country", "country_code", "nation", "geography", "geo",
  ],
  region: [
    "region", "state", "province", "area", "territory",
  ],
  fuelType: [
    "fuel_type", "fuel", "fuel_source", "energy_source", "fuel_name",
  ],
  transportMode: [
    "transport_mode", "mode", "mode_of_transport", "vehicle_type", "travel_mode",
  ],
  refrigerantType: [
    "refrigerant", "refrigerant_type", "gas_type", "f_gas", "hfc_type",
  ],
  distanceAmount: [
    "distance", "distance_amount", "distance_km", "km", "miles", "mileage",
  ],
  distanceUnit: [
    "distance_unit", "unit_of_distance",
  ],
  spendAmount: [
    "spend_amount", "cost", "expenditure", "invoice_amount", "total_cost",
    "payment", "amount_spent", "price",
  ],
  spendCurrency: [
    "currency", "spend_currency", "ccy", "currency_code",
  ],
  scope2Method: [
    "scope2_method", "scope_2_method", "electricity_method", "market_location_based",
    "mb_lb", "accounting_method",
  ],
  assumptionNotes: [
    "assumptions", "assumption_notes", "comments", "data_quality", "quality_notes",
    "caveats",
  ],
  dataOrigin: [
    "data_origin", "origin", "data_source_type", "source_type", "data_type",
    "provenance", "data_provenance", "measurement_type", "data_tier", "evidence_type",
  ],
  dataOriginNote: [
    "data_origin_note", "origin_note", "origin_justification", "estimation_basis",
    "proxy_basis", "provenance_note",
  ],
};

function buildAliasIndex(synonyms: Record<string, string[]>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(synonyms)) {
    for (const alias of aliases) {
      if (!index.has(alias)) index.set(alias.toLowerCase(), canonical);
    }
  }
  return index;
}

const ACTIVITY_ALIAS_INDEX = buildAliasIndex(ACTIVITY_SYNONYMS);

export type MappedColumn = {
  sourceHeader: string;
  canonicalField: string;
  confidence: "exact" | "synonym";
};

export type MappingResult = {
  mapped: MappedColumn[];
  unmapped: string[];
  missingRequired: string[];
};

/**
 * Given the raw headers from an uploaded file, return the best mapping to
 * canonical field names. Headers are normalised to lowercase_with_underscores
 * before lookup so "Fuel Type" and "fuel_type" both resolve.
 */
export function detectActivityColumnMapping(sourceHeaders: string[]): MappingResult {
  const mapped: MappedColumn[] = [];
  const unmapped: string[] = [];
  const usedCanonicals = new Set<string>();

  for (const header of sourceHeaders) {
    const normalized = header.trim().toLowerCase().replaceAll(/[\s-]+/g, "_");
    const canonical = ACTIVITY_ALIAS_INDEX.get(normalized);
    if (canonical && !usedCanonicals.has(canonical)) {
      const confidence = normalized === canonical ? "exact" : "synonym";
      mapped.push({ sourceHeader: header, canonicalField: canonical, confidence });
      usedCanonicals.add(canonical);
    } else {
      unmapped.push(header);
    }
  }

  const requiredFields = CANONICAL_FIELDS.filter((f) => f.required).map((f) => f.canonical);
  const missingRequired = requiredFields.filter((f) => !usedCanonicals.has(f));

  return { mapped, unmapped, missingRequired };
}

/**
 * Convert a DetectedMapping into the Map<rawHeader, canonicalField> format
 * expected by validator.ts's validateRow().
 */
export function toColumnMap(result: MappingResult): Map<string, string> {
  const map = new Map<string, string>();
  for (const { sourceHeader, canonicalField } of result.mapped) {
    map.set(sourceHeader, canonicalField);
  }
  return map;
}
