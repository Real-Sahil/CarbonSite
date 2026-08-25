// Utilities connector — parse meter readings and utility bills (gas, electricity, water, waste)
// Supports CSV exports from major UK suppliers (EDF, Shell Energy, Severn Trent, Thames Water, etc.)

import { z } from "zod";
import type { ConnectorPayload, ConnectorActivityRecord, IConnector } from "./types";

const UtilitiesRowSchema = z.object({
  meterId: z.string(), // Meter ID/MPAN for electricity, MPRN for gas
  meterType: z.enum(["electricity", "gas", "water", "waste"]),
  readingDate: z.string(), // ISO date or DD/MM/YYYY
  usage: z.string(), // Consumption value
  unit: z.string(), // kWh, m³, tonnes, litres
  supplier: z.string().optional(),
  meterPostcode: z.string().optional(),
  meterAddress: z.string().optional(),
  scope2Method: z.enum(["location_based", "market_based"]).optional().default("location_based"),
  description: z.string().optional(),
});

type UtilitiesRow = z.infer<typeof UtilitiesRowSchema>;

// Meter type → Category mapping
const METER_TO_CATEGORY: Record<string, string> = {
  electricity: "s2-electricity-lb", // Location-based by default
  gas: "s1-stationary", // On-site combustion
  water: "s3-purchased-goods", // Water supply as purchased good
  waste: "s3-purchased-goods", // Waste disposal
};

export class UtilitiesConnector implements IConnector {
  name = "utilities";
  version = "1.0";

  async ingest(payload: unknown): Promise<ConnectorPayload> {
    const payloadSchema = z.object({
      rows: z.array(z.record(z.unknown())),
      externalBatchId: z.string().optional(),
    });

    const parsed = payloadSchema.parse(payload);

    const records: ConnectorActivityRecord[] = [];
    const errors: string[] = [];

    for (let idx = 0; idx < parsed.rows.length; idx++) {
      const rowData = parsed.rows[idx];

      try {
        const row = UtilitiesRowSchema.parse(rowData);

        if (!row.meterId || row.meterId.trim() === "") {
          throw new Error("Meter ID is required");
        }

        const usage = this.parseUsage(row.usage);
        if (usage <= 0) {
          throw new Error("Usage must be a valid number > 0");
        }

        // Validate unit is recognized
        if (!this.isValidUnit(row.unit)) {
          throw new Error(`Unit '${row.unit}' not recognized (expected kWh, m³, tonnes, litres, etc.)`);
        }

        const record = this.parseUtilitiesRow(row, idx + 1, parsed.externalBatchId);
        records.push(record);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${idx + 1}: ${msg}`);
      }
    }

    if (records.length === 0) {
      throw new Error(`No valid records found in utilities export. Errors: ${errors.join("; ")}`);
    }

    return {
      records,
      metadata: {
        provider: "utilities",
        ingestionDate: new Date(),
        sourceSystem: "utility_meter_readings",
        externalBatchId: parsed.externalBatchId,
      },
    };
  }

  private parseUtilitiesRow(
    row: UtilitiesRow,
    rowNumber: number,
    externalBatchId: string | undefined
  ): ConnectorActivityRecord {
    const activityDate = this.parseDate(row.readingDate);
    const categoryCode = METER_TO_CATEGORY[row.meterType];
    const usage = this.parseUsage(row.usage);

    // Normalize units for consistency
    const normalizedUnit = this.normalizeUnit(row.unit, row.meterType);

    // Update category for market-based electricity
    let finalCategoryCode = categoryCode;
    if (row.meterType === "electricity" && row.scope2Method === "market_based") {
      finalCategoryCode = "s2-electricity-mb";
    }

    // Supplier name or postcode identifier
    const supplierName = row.supplier || row.meterPostcode || "Unknown Utility Supplier";

    // Build source description
    const sourceDescription = `${row.meterType.charAt(0).toUpperCase() + row.meterType.slice(1)} Reading ${row.meterId}`;

    const warnings: string[] = [];

    // Flag meter readings with missing postcode (needed for location-based electricity grid factors)
    if (
      row.meterType === "electricity" &&
      row.scope2Method === "location_based" &&
      !row.meterPostcode
    ) {
      warnings.push(
        "No meter postcode provided. Location-based emission factor may be less accurate."
      );
    }

    return {
      externalRecordId: `${row.meterId}-${row.readingDate}`,
      externalBatchId,
      emissionCategoryCode: finalCategoryCode,
      activityDate,

      // Physical quantity (not spend-based)
      amount: usage,
      unit: normalizedUnit,

      // Context
      sourceDescription,
      supplierName,
      country: "UK", // Default to UK (adjust if supporting other regions)
      region: this.extractRegionFromPostcode(row.meterPostcode),

      // Scope 2 method
      scope2Method: row.meterType === "electricity" ? row.scope2Method : undefined,

      // Fuel type (for clarity)
      fuelType: row.meterType === "gas" ? "natural_gas" : row.meterType,

      // Warnings
      validationWarnings: warnings,
    };
  }

  private parseDate(dateStr: string): Date {
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      return new Date(year, month - 1, day);
    }

    console.warn(`[utilities-connector] Could not parse date "${dateStr}", using today`);
    return new Date();
  }

  private parseUsage(usageStr: string): number {
    return parseFloat(usageStr.replace(/,/g, "")) || 0;
  }

  private isValidUnit(unit: string): boolean {
    const validUnits = ["kWh", "kwh", "m³", "m3", "litres", "liters", "l", "tonnes", "tonne", "kg"];
    return validUnits.some((u) => u.toLowerCase() === unit.toLowerCase());
  }

  private normalizeUnit(unit: string, meterType: string): string {
    const lower = unit.toLowerCase();

    // Electricity
    if (meterType === "electricity") return "kWh";

    // Gas (cubic meters)
    if (meterType === "gas") return lower.includes("m") ? "m³" : unit;

    // Water (cubic meters)
    if (meterType === "water") return lower.includes("m") ? "m³" : "litres";

    // Waste (tonnes)
    if (meterType === "waste") return lower.includes("kg") ? "kg" : "tonnes";

    return unit;
  }

  private extractRegionFromPostcode(postcode: string | undefined): string | undefined {
    if (!postcode) return undefined;

    // UK postcode regions (first 1-2 characters)
    // e.g., "SW1A 1AA" → "SW" (South West London), "M1 1AA" → "M" (Manchester)
    const region = postcode.split(" ")[0].replace(/\d.*/, ""); // Remove numbers
    return region || undefined;
  }
}
