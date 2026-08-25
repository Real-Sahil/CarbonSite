import { describe, it, expect } from "vitest";
import { SageConnector } from "../sage-connector";

describe("SageConnector", () => {
  const connector = new SageConnector();

  it("should parse valid Sage invoices", async () => {
    const payload = {
      rows: [
        {
          invoiceRef: "PI-12345",
          invoiceDate: "2026-08-15",
          supplier: "Fuel Supplier Co",
          netAmount: "3000.00",
          currency: "GBP",
          nominialCode: "5001",
          description: "Fleet fuel supply",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      externalRecordId: "PI-12345",
      emissionCategoryCode: "s1-mobile",
      spendAmount: 3000,
    });
  });

  it("should map GL nominal codes to emission categories", async () => {
    const payload = {
      rows: [
        {
          invoiceRef: "PI-001",
          invoiceDate: "2026-08-20",
          supplier: "Energy Supplier",
          netAmount: "2000.00",
          nominialCode: "5100",
          description: "Electricity bill",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].emissionCategoryCode).toBe("s2-electricity-lb");
  });

  it("should default to Scope 3 for unmapped accounts", async () => {
    const payload = {
      rows: [
        {
          invoiceRef: "PI-002",
          invoiceDate: "2026-08-01",
          netAmount: "500.00",
          nominialCode: "9999",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].emissionCategoryCode).toBe("s3-purchased-goods");
  });

  it("should handle DD/MM/YYYY date format", async () => {
    const payload = {
      rows: [
        {
          invoiceRef: "PI-003",
          invoiceDate: "15/08/2026",
          supplier: "Test",
          netAmount: "100.00",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].activityDate?.getDate()).toBe(15);
    expect(result.records[0].activityDate?.getMonth()).toBe(7);
  });

  it("should parse amounts with comma separators", async () => {
    const payload = {
      rows: [
        {
          invoiceRef: "PI-004",
          invoiceDate: "2026-08-01",
          netAmount: "1,234,567.89",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].spendAmount).toBe(1234567.89);
  });

  it("should flag spend-based records", async () => {
    const payload = {
      rows: [
        {
          invoiceRef: "PI-005",
          invoiceDate: "2026-08-10",
          netAmount: "500.00",
          description: "Services rendered",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].validationWarnings).toContain(
      "No physical quantity found in description. Using spend-based fallback."
    );
  });

  it("should reject empty invoice references", async () => {
    const payload = {
      rows: [
        {
          invoiceRef: "",
          invoiceDate: "2026-08-15",
          netAmount: "500.00",
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow("No valid records found");
  });

  it("should use cost code as business unit", async () => {
    const payload = {
      rows: [
        {
          invoiceRef: "PI-006",
          invoiceDate: "2026-08-01",
          netAmount: "800.00",
          costCode: "PROJECT-123",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].businessUnitCode).toBe("PROJECT-123");
  });
});
