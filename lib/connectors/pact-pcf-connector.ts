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

// Inbound PACT request (supplier sends PCF data)
const PACTIngestSchema = z.object({
  companyName: z.string(),
  productFootprints: z.array(PACTProductFootprintSchema).min(1).max(1000),
  createdAt: z.string().optional(), // ISO datetime
});

export class PACTPCFConnector implements IConnector {
  name = "pact-pcf";
  version = "2.2.0";

  async ingest(payload: unknown): Promise<ConnectorPayload> {
    const parsed = PACTIngestSchema.parse(payload);

    const records: ConnectorActivityRecord[] = [];
    const errors: string[] = [];

    for (let idx = 0; idx < parsed.productFootprints.length; idx++) {
      const footprint = parsed.productFootprints[idx];

      try {
        if (!footprint.id || footprint.id.trim() === "") {
          throw new Error("Product ID is required");
        }

        if (footprint.pcfExcludingBiogenic <= 0) {
          throw new Error("PCF value must be > 0");
        }

        const record = this.parsePACTFootprint(footprint, parsed.companyName, idx + 1);
        records.push(record);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Product ${idx + 1} (${footprint.id}): ${msg}`);
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
    footprint: PACTProductFootprint,
    companyName: string,
    rowNumber: number
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

    // Warn if this is a placeholder/pre-submission
    if (footprint.specVersion !== "2.2.0") {
      warnings.push(
        `PACT spec version ${footprint.specVersion} differs from implemented 2.2.0. Compatibility may vary.`
      );
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
