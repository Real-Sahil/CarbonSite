// PACT/PCF Connector — parse Pathfinder Data Exchange Format (DXF) for supplier Scope 3 data
// Implements https://wbcsd.github.io/data-exchange-protocol/

import { z } from "zod";
import type { ConnectorPayload, ConnectorActivityRecord, IConnector } from "./types";

// Simplified PACT DXF schema (core fields for Scope 3 supplier data)
const PACTProductFootprintSchema = z.object({
  id: z.string(), // Product identifier (SKU)
  name: z.string().optional(),
  declaredUnit: z.enum(["kg", "litre", "m3", "kWh", "MJ", "unit"]),
  pcfExcludingBiogenic: z.number().positive(),
  pcfIncludingBiogenic: z.number().optional(),
  fossilGhgEmissions: z.number().optional(),
  biogenicGhgEmissions: z.number().optional(),
  biogenicCarbonContent: z.number().optional(),
  dUProductionDate: z.string().optional(), // ISO date
  fpXML: z.string().optional(), // Full XML payload
  comment: z.string().optional(),
  specVersion: z.string().default("2.2.0"), // PACT spec version
});

type PACTProductFootprint = z.infer<typeof PACTProductFootprintSchema>;

// TfS PCF Data Model 3.1 (September 2025): nested productionStage, declared unit names, no production date
const PACTv31FootprintSchema = z.object({
  specVersion: z.union([z.string(), z.array(z.string()).min(1)]), // URNs, e.g. urn:tfs-initiative.com:datamodel-version:3.1.0
  productNameCompany: z.string().optional(),
  productIds: z.array(z.string()).min(1),
  declaredUnitOfMeasurement: z.string(),
  declaredUnitAmount: z.number().positive(),
  productionStage: z.object({ pcfExcludingBiogenic: z.number().positive() }),
  pcfIncludingBiogenicUptake: z.number().optional(), // kg CO2e per declared unit
  completedAt: z.string().optional(), // attestation date, ISO 8601
});

type PACTv31Footprint = z.infer<typeof PACTv31FootprintSchema>;

// TfS 3.1 declared unit names that map onto the 2.2.0 enum; any other name fails that product only
const PACT_V31_UNITS = new Map<string, PACTProductFootprint["declaredUnit"]>([
  ["piece", "unit"],
  ["kilogram", "kg"],
  ["liter", "litre"],
  ["cubic meter", "m3"],
  ["kilowatt hour", "kWh"],
  ["megajoule", "MJ"],
]);

// Maps a 3.1 footprint onto the 2.2.0 shape the parser takes; throws for a unit it cannot map
function fromPact31(footprint: PACTv31Footprint): Omit<PACTProductFootprint, "specVersion"> {
  const declaredUnit = PACT_V31_UNITS.get(footprint.declaredUnitOfMeasurement);
  if (!declaredUnit) {
    throw new Error(`Unsupported declared unit: ${footprint.declaredUnitOfMeasurement}`);
  }
  return {
    id: footprint.productIds[0],
    name: footprint.productNameCompany,
    declaredUnit,
    pcfExcludingBiogenic: footprint.productionStage.pcfExcludingBiogenic,
    pcfIncludingBiogenic: footprint.pcfIncludingBiogenicUptake,
    // shortcut: 3.1 has no production date, attestation date stands in, upgrade when production date is mapped
    dUProductionDate: footprint.completedAt,
  };
}

// Inbound PACT request (supplier sends PCF data)
const PACTIngestSchema = z.object({
  companyName: z.string(),
  productFootprints: z
    .array(z.union([PACTProductFootprintSchema, PACTv31FootprintSchema]))
    .min(1)
    .max(1000),
  createdAt: z.string().optional(), // ISO datetime
});

export class PACTPCFConnector implements IConnector {
  name = "pact-pcf";
  version = "3.1.0";

  async ingest(payload: unknown): Promise<ConnectorPayload> {
    const parsed = PACTIngestSchema.parse(payload);

    const records: ConnectorActivityRecord[] = [];
    const errors: string[] = [];

    for (let idx = 0; idx < parsed.productFootprints.length; idx++) {
      const raw = parsed.productFootprints[idx];
      const id = "productIds" in raw ? raw.productIds[0] : raw.id;

      try {
        const footprint = "productIds" in raw ? fromPact31(raw) : raw;

        if (!footprint.id || footprint.id.trim() === "") {
          throw new Error("Product ID is required");
        }

        if (footprint.pcfExcludingBiogenic <= 0) {
          throw new Error("PCF value must be > 0");
        }

        const versionWarning =
          "productIds" in raw || raw.specVersion === "2.2.0"
            ? undefined
            : `PACT spec version ${raw.specVersion} differs from implemented 2.2.0. Compatibility may vary.`;

        const record = this.parsePACTFootprint(footprint, parsed.companyName, versionWarning);
        records.push(record);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Product ${idx + 1} (${id}): ${msg}`);
      }
    }

    if (records.length === 0) {
      throw new Error(`No valid PACT footprints found. Errors: ${errors.join("; ")}`);
    }

    return {
      records,
      metadata: {
        provider: "pact-pcf",
        ingestionDate: new Date(),
        sourceSystem: "pact_dxf_supplier_submission",
        externalBatchId: `${parsed.companyName}-${new Date().toISOString()}`,
      },
    };
  }

  private parsePACTFootprint(
    footprint: Omit<PACTProductFootprint, "specVersion">,
    companyName: string,
    versionWarning?: string
  ): ConnectorActivityRecord {
    const activityDate = footprint.dUProductionDate
      ? new Date(footprint.dUProductionDate)
      : new Date();

    // PACT data represents Scope 3 purchased goods (supplier is providing their product's footprint)
    const categoryCode = "s3-purchased-goods";

    // Convert PCF to kg CO2e for consistency
    // PCF value is already in CO2e per the declared unit
    const co2ePerUnit = footprint.pcfExcludingBiogenic;

    const warnings: string[] = [];

    // Flag if using biogenic-inclusive PCF (needs clarification on scope)
    if (footprint.pcfIncludingBiogenic && footprint.pcfIncludingBiogenic !== co2ePerUnit) {
      warnings.push(
        "Using biogenic-excluding PCF. Biogenic-inclusive value available but not included."
      );
    }

    if (versionWarning) {
      warnings.push(versionWarning);
    }

    // Store the full PACT XML for audit/traceability if provided
    const facilityCode = footprint.fpXML ? "pact_xml_stored" : undefined;

    return {
      externalRecordId: `${companyName}-${footprint.id}`,
      externalBatchId: companyName,
      emissionCategoryCode: categoryCode,
      activityDate,

      // Physical quantity (in declared unit)
      amount: 1, // Normalized to 1 unit; PCF already includes the per-unit value
      unit: footprint.declaredUnit,

      // Financial/carbon quantity
      spendAmount: co2ePerUnit, // Use PCF as a proxy for spend-based fallback
      spendCurrency: "CO2e", // Not currency, but represents the carbon intensity

      // Context
      sourceDescription: `PACT PCF ${footprint.id} from ${companyName}`,
      supplierName: companyName,
      facilityCode, // Indicates PACT XML is stored for traceability

      // Warnings
      validationWarnings: warnings,
    };
  }
}

// Helper: Export MetricOra activity record to PACT format for supplier portal
export function exportToPACT(record: {
  externalRecordId: string;
  emissionCategoryCode: string;
  amount: number;
  unit: string;
  supplierName: string;
  sourceDescription: string;
}): Partial<PACTProductFootprint> {
  return {
    id: record.externalRecordId,
    name: record.sourceDescription,
    declaredUnit: normalizeUnitToPACT(record.unit),
    pcfExcludingBiogenic: record.amount,
    specVersion: "2.2.0",
  };
}

function normalizeUnitToPACT(
  unit: string
): "kg" | "litre" | "m3" | "kWh" | "MJ" | "unit" {
  const lower = unit.toLowerCase();

  if (lower.includes("kg")) return "kg";
  if (lower.includes("tonne") || lower.includes("ton")) return "kg"; // Convert to kg
  if (lower.includes("litre") || lower.includes("liter")) return "litre";
  if (lower.includes("m3") || lower.includes("m³")) return "m3";
  if (lower.includes("kwh")) return "kWh";
  if (lower.includes("mj")) return "MJ";

  return "unit"; // Default fallback
}
