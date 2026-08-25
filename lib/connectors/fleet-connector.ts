// Fleet connector — parse GPS and distance data from fleet management systems
// Supports Geotab, Samsara, Verizon Connect, and CSV exports

import { z } from "zod";
import type { ConnectorPayload, ConnectorActivityRecord, IConnector } from "./types";

const FleetRowSchema = z.object({
  vehicleId: z.string(), // Vehicle ID or registration
  vehicleName: z.string().optional(), // Driver name or vehicle name
  dateStart: z.string(), // Trip start date (ISO or DD/MM/YYYY)
  dateEnd: z.string().optional(), // Trip end date (optional)
  distanceTraveled: z.string(), // Distance value
  distanceUnit: z.enum(["km", "miles", "mi"]).default("km"),
  fuelType: z.enum(["diesel", "petrol", "electric", "hybrid", "lpg", "unknown"]).optional(),
  region: z.string().optional(), // Operating region/country
  driverName: z.string().optional(),
  vehicleType: z.enum(["car", "van", "truck", "articulated_truck", "motorcycle", "unknown"]).optional(),
  engineSize: z.string().optional(), // Engine displacement (cc or litres)
  description: z.string().optional(),
});

type FleetRow = z.infer<typeof FleetRowSchema>;

export class FleetConnector implements IConnector {
  name = "fleet";
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
        const row = FleetRowSchema.parse(rowData);

        if (!row.vehicleId || row.vehicleId.trim() === "") {
          throw new Error("Vehicle ID is required");
        }

        const distance = this.parseDistance(row.distanceTraveled);
        if (distance <= 0) {
          throw new Error("Distance must be a valid number > 0");
        }

        const record = this.parseFleetRow(row, idx + 1, parsed.externalBatchId);
        records.push(record);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${idx + 1}: ${msg}`);
      }
    }

    if (records.length === 0) {
      throw new Error(`No valid records found in fleet data. Errors: ${errors.join("; ")}`);
    }

    return {
      records,
      metadata: {
        provider: "fleet",
        ingestionDate: new Date(),
        sourceSystem: "fleet_telematics",
        externalBatchId: parsed.externalBatchId,
      },
    };
  }

  private parseFleetRow(
    row: FleetRow,
    rowNumber: number,
    externalBatchId: string | undefined
  ): ConnectorActivityRecord {
    const activityDate = this.parseDate(row.dateStart);
    const distance = this.parseDistance(row.distanceTraveled);
    const distanceInKm = this.normalizeToKm(distance, row.distanceUnit);

    // Fleet vehicles = Scope 1 (mobile combustion)
    const categoryCode = "s1-mobile";

    // Build supplier/operator name
    const supplierName =
      row.driverName || row.vehicleName || row.vehicleId || "Unknown Driver";

    // Build source description
    const sourceDescription = `Fleet Trip ${row.vehicleId} (${distanceInKm.toFixed(1)} km)`;

    const warnings: string[] = [];

    // Flag if fuel type is unknown or hybrid (requires assumptions)
    if (!row.fuelType || row.fuelType === "unknown" || row.fuelType === "hybrid") {
      warnings.push(
        "Fuel type not specified or hybrid. Emission factor may need manual adjustment."
      );
    }

    // Flag if vehicle type not specified (impacts emission factor selection)
    if (!row.vehicleType || row.vehicleType === "unknown") {
      warnings.push("Vehicle type not specified. Using default car emission factor.");
    }

    return {
      externalRecordId: `${row.vehicleId}-${row.dateStart}`,
      externalBatchId,
      emissionCategoryCode: categoryCode,
      activityDate,

      // Physical quantity (distance-based)
      amount: distanceInKm,
      unit: "km",

      // Context
      sourceDescription,
      supplierName, // Driver name
      country: this.getCountryFromRegion(row.region),
      region: row.region,

      // Fuel & transport details
      fuelType: row.fuelType || "unknown",
      transportMode: this.mapVehicleTypeToTransportMode(row.vehicleType),

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

    console.warn(`[fleet-connector] Could not parse date "${dateStr}", using today`);
    return new Date();
  }

  private parseDistance(distanceStr: string): number {
    return parseFloat(distanceStr.replace(/,/g, "")) || 0;
  }

  private normalizeToKm(distance: number, unit: string): number {
    if (unit === "miles" || unit === "mi") {
      return distance * 1.60934; // miles to km
    }
    return distance; // already in km
  }

  private mapVehicleTypeToTransportMode(vehicleType?: string): string {
    if (!vehicleType || vehicleType === "unknown") return "car";

    const mapping: Record<string, string> = {
      car: "car",
      van: "van",
      truck: "truck",
      articulated_truck: "truck",
      motorcycle: "motorcycle",
    };

    return mapping[vehicleType] || "car";
  }

  private getCountryFromRegion(region?: string): string | undefined {
    if (!region) return undefined;
    const lower = region.toLowerCase();
    if (lower.includes("uk") || lower.includes("gb") || region === "UK") {
      return "UK";
    }
    return undefined;
  }
}
