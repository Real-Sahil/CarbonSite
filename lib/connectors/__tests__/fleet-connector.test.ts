import { describe, it, expect } from "vitest";
import { FleetConnector } from "../fleet-connector";

describe("FleetConnector", () => {
  const connector = new FleetConnector();

  it("should parse valid fleet trips in km", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "VEH-001",
          vehicleName: "Van 1",
          dateStart: "2026-08-15",
          distanceTraveled: "150.5",
          distanceUnit: "km",
          fuelType: "diesel",
          vehicleType: "van",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      externalRecordId: expect.stringContaining("VEH-001"),
      emissionCategoryCode: "s1-mobile",
      amount: 150.5,
      unit: "km",
      fuelType: "diesel",
    });
  });

  it("should convert miles to km", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "VEH-002",
          dateStart: "2026-08-20",
          distanceTraveled: "100",
          distanceUnit: "miles",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].amount).toBeCloseTo(160.934, 1); // 100 miles ≈ 160.934 km
  });

  it("should map vehicle types to transport modes", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "VEH-003",
          dateStart: "2026-08-01",
          distanceTraveled: "50",
          distanceUnit: "km",
          vehicleType: "articulated_truck",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].transportMode).toBe("truck");
  });

  it("should flag unknown fuel type with warning", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "VEH-004",
          dateStart: "2026-08-10",
          distanceTraveled: "100",
          distanceUnit: "km",
          fuelType: "unknown",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].validationWarnings).toContain(
      "Fuel type not specified or hybrid. Emission factor may need manual adjustment."
    );
  });

  it("should flag missing vehicle type", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "VEH-005",
          dateStart: "2026-08-15",
          distanceTraveled: "200",
          distanceUnit: "km",
          fuelType: "diesel",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].validationWarnings).toContain(
      "Vehicle type not specified. Using default car emission factor."
    );
  });

  it("should handle dates in DD/MM/YYYY format", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "VEH-006",
          dateStart: "15/08/2026",
          distanceTraveled: "100",
          distanceUnit: "km",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].activityDate?.getDate()).toBe(15);
    expect(result.records[0].activityDate?.getMonth()).toBe(7); // August (0-indexed)
  });

  it("should use driver name as supplier", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "VEH-007",
          driverName: "John Smith",
          dateStart: "2026-08-01",
          distanceTraveled: "75",
          distanceUnit: "km",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].supplierName).toBe("John Smith");
  });

  it("should reject empty vehicle ID", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "",
          dateStart: "2026-08-01",
          distanceTraveled: "100",
          distanceUnit: "km",
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow("No valid records found");
  });

  it("should reject zero or negative distance", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "VEH-008",
          dateStart: "2026-08-01",
          distanceTraveled: "0",
          distanceUnit: "km",
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow("No valid records found");
  });

  it("should set country to UK for UK region", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "VEH-009",
          dateStart: "2026-08-01",
          distanceTraveled: "100",
          distanceUnit: "km",
          region: "UK",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].country).toBe("UK");
  });

  it("should parse comma-separated distances", async () => {
    const payload = {
      rows: [
        {
          vehicleId: "VEH-010",
          dateStart: "2026-08-01",
          distanceTraveled: "1,234.56",
          distanceUnit: "km",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].amount).toBe(1234.56);
  });
});
