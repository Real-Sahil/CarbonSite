import { describe, it, expect } from "vitest";
import { UtilitiesConnector } from "../utilities-connector";

describe("UtilitiesConnector", () => {
  const connector = new UtilitiesConnector();

  it("should parse valid electricity meter readings", async () => {
    const payload = {
      rows: [
        {
          meterId: "MPAN-001",
          meterType: "electricity",
          readingDate: "2026-08-15",
          usage: "1500.00",
          unit: "kWh",
          supplier: "National Grid",
          meterPostcode: "SW1A 1AA",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      externalRecordId: expect.stringContaining("MPAN-001"),
      emissionCategoryCode: "s2-electricity-lb",
      amount: 1500,
      unit: "kWh",
      supplierName: "National Grid",
    });
  });

  it("should map meter types to categories", async () => {
    const meterTests = [
      { type: "electricity", expected: "s2-electricity-lb" },
      { type: "gas", expected: "s1-stationary" },
      { type: "water", expected: "s3-purchased-goods" },
      { type: "waste", expected: "s3-purchased-goods" },
    ];

    for (const test of meterTests) {
      const payload = {
        rows: [
          {
            meterId: `METER-${test.type}`,
            meterType: test.type as "electricity" | "gas" | "water" | "waste",
            readingDate: "2026-08-01",
            usage: "100",
            unit: test.type === "electricity" ? "kWh" : "m³",
          },
        ],
      };

      const result = await connector.ingest(payload);
      expect(result.records[0].emissionCategoryCode).toBe(test.expected);
    }
  });

  it("should support market-based electricity", async () => {
    const payload = {
      rows: [
        {
          meterId: "MPAN-002",
          meterType: "electricity",
          readingDate: "2026-08-20",
          usage: "2000.00",
          unit: "kWh",
          scope2Method: "market_based",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].emissionCategoryCode).toBe("s2-electricity-mb");
    expect(result.records[0].scope2Method).toBe("market_based");
  });

  it("should normalize units correctly", async () => {
    const payload = {
      rows: [
        {
          meterId: "METER-GAS",
          meterType: "gas",
          readingDate: "2026-08-15",
          usage: "500",
          unit: "m3", // lowercase, no symbol
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].unit).toBe("m³");
  });

  it("should warn when postcode missing for location-based electricity", async () => {
    const payload = {
      rows: [
        {
          meterId: "MPAN-003",
          meterType: "electricity",
          readingDate: "2026-08-01",
          usage: "1000",
          unit: "kWh",
          scope2Method: "location_based",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].validationWarnings).toContain(
      "No meter postcode provided. Location-based emission factor may be less accurate."
    );
  });

  it("should extract UK region from postcode", async () => {
    const payload = {
      rows: [
        {
          meterId: "METER-001",
          meterType: "electricity",
          readingDate: "2026-08-01",
          usage: "1000",
          unit: "kWh",
          meterPostcode: "M1 1AA", // Manchester
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].region).toBe("M");
  });

  it("should reject invalid meter IDs", async () => {
    const payload = {
      rows: [
        {
          meterId: "",
          meterType: "electricity",
          readingDate: "2026-08-01",
          usage: "1000",
          unit: "kWh",
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow("No valid records found");
  });

  it("should reject zero or negative usage", async () => {
    const payload = {
      rows: [
        {
          meterId: "METER-002",
          meterType: "electricity",
          readingDate: "2026-08-01",
          usage: "0",
          unit: "kWh",
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow("No valid records found");
  });

  it("should support water meter readings", async () => {
    const payload = {
      rows: [
        {
          meterId: "WATER-001",
          meterType: "water",
          readingDate: "2026-08-10",
          usage: "500.5",
          unit: "m³",
          supplier: "Thames Water",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].amount).toBe(500.5);
    expect(result.records[0].emissionCategoryCode).toBe("s3-purchased-goods");
  });

  it("should set country to UK by default", async () => {
    const payload = {
      rows: [
        {
          meterId: "METER-003",
          meterType: "gas",
          readingDate: "2026-08-01",
          usage: "200",
          unit: "m³",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].country).toBe("UK");
  });
});
