import { describe, it, expect } from "vitest";
import { PACTPCFConnector, exportToPACT } from "../pact-pcf-connector";

describe("PACTPCFConnector", () => {
  const connector = new PACTPCFConnector();

  it("should parse valid PACT product footprints", async () => {
    const payload = {
      companyName: "Acme Materials Ltd",
      productFootprints: [
        {
          id: "SKU-12345",
          name: "Steel Beams Grade A",
          declaredUnit: "kg",
          pcfExcludingBiogenic: 2.45,
          dUProductionDate: "2026-08-15",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      externalRecordId: expect.stringContaining("SKU-12345"),
      emissionCategoryCode: "s3-purchased-goods",
      amount: 1,
      unit: "kg",
      spendAmount: 2.45,
      supplierName: "Acme Materials Ltd",
    });
  });

  it("should support different declared units", async () => {
    const units = ["kg", "litre", "m3", "kWh", "MJ", "unit"];

    for (const unit of units) {
      const payload = {
        companyName: "Test Supplier",
        productFootprints: [
          {
            id: `SKU-${unit}`,
            declaredUnit: unit as any,
            pcfExcludingBiogenic: 1.5,
          },
        ],
      };

      const result = await connector.ingest(payload);

      expect(result.records[0].unit).toBe(unit);
    }
  });

  it("should always categorize as Scope 3 purchased goods", async () => {
    const payload = {
      companyName: "Supplier Co",
      productFootprints: [
        {
          id: "SKU-001",
          declaredUnit: "kg",
          pcfExcludingBiogenic: 3.0,
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].emissionCategoryCode).toBe("s3-purchased-goods");
  });

  it("should flag when biogenic-inclusive PCF differs", async () => {
    const payload = {
      companyName: "Supplier Co",
      productFootprints: [
        {
          id: "SKU-002",
          declaredUnit: "kg",
          pcfExcludingBiogenic: 2.0,
          pcfIncludingBiogenic: 2.5, // Different from excluding
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].validationWarnings).toContain(
      "Using biogenic-excluding PCF. Biogenic-inclusive value available but not included."
    );
  });

  it("should reject empty product ID", async () => {
    const payload = {
      companyName: "Supplier Co",
      productFootprints: [
        {
          id: "",
          declaredUnit: "kg",
          pcfExcludingBiogenic: 1.0,
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow("No valid PACT footprints found");
  });

  it("should reject zero or negative PCF", async () => {
    const payload = {
      companyName: "Supplier Co",
      productFootprints: [
        {
          id: "SKU-003",
          declaredUnit: "kg",
          pcfExcludingBiogenic: -0.5,
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow();
  });

  it("should parse production date if provided", async () => {
    const payload = {
      companyName: "Supplier Co",
      productFootprints: [
        {
          id: "SKU-004",
          declaredUnit: "kg",
          pcfExcludingBiogenic: 1.5,
          dUProductionDate: "2026-06-15",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].activityDate?.getDate()).toBe(15);
    expect(result.records[0].activityDate?.getMonth()).toBe(5); // June (0-indexed)
  });

  it("should use current date if production date not provided", async () => {
    const payload = {
      companyName: "Supplier Co",
      productFootprints: [
        {
          id: "SKU-005",
          declaredUnit: "kg",
          pcfExcludingBiogenic: 1.5,
        },
      ],
    };

    const result = await connector.ingest(payload);
    const today = new Date();

    // Allow 1 second difference for timing
    expect(Math.abs(result.records[0].activityDate!.getTime() - today.getTime())).toBeLessThan(1000);
  });

  it("should support PACT spec version checking", async () => {
    const payload = {
      companyName: "Supplier Co",
      productFootprints: [
        {
          id: "SKU-006",
          declaredUnit: "kg",
          pcfExcludingBiogenic: 1.0,
          specVersion: "2.1.0", // Different from implemented 2.2.0
        },
      ],
    };

    const result = await connector.ingest(payload);

    // Should have a warning about version mismatch
    expect(result.records[0].validationWarnings.length).toBeGreaterThan(0);
    const versionWarning = result.records[0].validationWarnings.find((w) =>
      w.includes("spec version")
    );
    expect(versionWarning).toBeDefined();
  });

  it("should handle multiple products in one batch", async () => {
    const payload = {
      companyName: "Acme Corp",
      productFootprints: [
        { id: "SKU-001", declaredUnit: "kg", pcfExcludingBiogenic: 1.0 },
        { id: "SKU-002", declaredUnit: "kg", pcfExcludingBiogenic: 2.0 },
        { id: "SKU-003", declaredUnit: "kg", pcfExcludingBiogenic: 1.5 },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records).toHaveLength(3);
    expect(result.records.map((r) => r.spendAmount)).toEqual([1.0, 2.0, 1.5]);
  });
});

describe("exportToPACT", () => {
  it("should convert activity record to PACT format", () => {
    const record = {
      externalRecordId: "PROD-123",
      emissionCategoryCode: "s3-purchased-goods",
      amount: 100,
      unit: "kg",
      supplierName: "Supplier Co",
      sourceDescription: "Steel product",
    };

    const pactRecord = exportToPACT(record);

    expect(pactRecord).toMatchObject({
      id: "PROD-123",
      name: "Steel product",
      declaredUnit: "kg",
      pcfExcludingBiogenic: 100,
      specVersion: "2.2.0",
    });
  });

  it("should normalize units to PACT format", () => {
    const testCases = [
      { input: "kg", expected: "kg" },
      { input: "tonne", expected: "kg" },
      { input: "litre", expected: "litre" },
      { input: "m³", expected: "m3" },
      { input: "kWh", expected: "kWh" },
      { input: "MJ", expected: "MJ" },
      { input: "unknown", expected: "unit" },
    ];

    for (const test of testCases) {
      const record = {
        externalRecordId: "TEST",
        emissionCategoryCode: "s3-purchased-goods",
        amount: 1,
        unit: test.input,
        supplierName: "Test",
        sourceDescription: "Test",
      };

      const pactRecord = exportToPACT(record);
      expect(pactRecord.declaredUnit).toBe(test.expected);
    }
  });
});
