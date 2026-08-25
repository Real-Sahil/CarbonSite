import { describe, it, expect } from "vitest";
import { XeroConnector } from "../xero-connector";

describe("XeroConnector", () => {
  const connector = new XeroConnector();

  it("should parse a valid Xero invoice export", async () => {
    const payload = {
      rows: [
        {
          InvoiceNumber: "INV-001",
          Date: "2026-08-15",
          Supplier: "Acme Fuels Ltd",
          Amount: "1500.00",
          Currency: "GBP",
          Account: "5001",
          Description: "Fleet fuel - diesel",
        },
      ],
      externalBatchId: "batch_001",
    };

    const result = await connector.ingest(payload);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      externalRecordId: "INV-001",
      emissionCategoryCode: "s1-mobile",
      spendAmount: 1500,
      spendCurrency: "GBP",
      supplierName: "Acme Fuels Ltd",
      sourceDescription: "Xero Invoice INV-001",
    });
    expect(result.metadata.provider).toBe("xero");
  });

  it("should map Scope 2 electricity correctly", async () => {
    const payload = {
      rows: [
        {
          InvoiceNumber: "INV-002",
          Date: "2026-08-20",
          Supplier: "National Grid",
          Amount: "2000.00",
          Currency: "GBP",
          Account: "5100",
          Description: "Monthly electricity bill",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].emissionCategoryCode).toBe("s2-electricity-lb");
  });

  it("should flag high-uncertainty Scope 3 records with warnings", async () => {
    const payload = {
      rows: [
        {
          InvoiceNumber: "INV-003",
          Date: "2026-08-25",
          Supplier: "Consultant Group Inc",
          Amount: "5000.00",
          Currency: "GBP",
          Account: "6100",
          Description: "Business consulting services",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].emissionCategoryCode).toBe("s3-business-travel");
    expect(result.records[0].validationWarnings).toContain(
      "No physical quantity found in description. Using spend-based fallback."
    );
  });

  it("should handle DD/MM/YYYY date format", async () => {
    const payload = {
      rows: [
        {
          InvoiceNumber: "INV-004",
          Date: "15/08/2026",
          Supplier: "Test",
          Amount: "100.00",
          Account: "5001",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].activityDate?.getDate()).toBe(15);
    expect(result.records[0].activityDate?.getMonth()).toBe(7); // August (0-indexed)
  });

  it("should parse amounts with comma separators", async () => {
    const payload = {
      rows: [
        {
          InvoiceNumber: "INV-005",
          Date: "2026-08-01",
          Amount: "1,234,567.89",
          Account: "5000",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].spendAmount).toBe(1234567.89);
  });

  it("should throw if no valid records found", async () => {
    const payload = {
      rows: [
        {
          InvoiceNumber: "", // Invalid: empty invoice number
          Date: "invalid-date",
          Amount: "not-a-number",
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow(
      "No valid records found"
    );
  });

  it("should default to Scope 3 for unmapped accounts", async () => {
    const payload = {
      rows: [
        {
          InvoiceNumber: "INV-006",
          Date: "2026-08-01",
          Amount: "500.00",
          Account: "9999", // Unknown account code
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].emissionCategoryCode).toBe("s3-purchased-goods");
  });
});
