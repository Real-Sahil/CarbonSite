import { describe, it, expect } from "vitest";
import { QuickBooksConnector } from "../quickbooks-connector";

describe("QuickBooksConnector", () => {
  const connector = new QuickBooksConnector();

  it("should parse valid QuickBooks bills", async () => {
    const payload = {
      rows: [
        {
          docNumber: "BILL-001",
          docDate: "2026-08-15",
          vendor: "Acme Energy",
          amount: "2500.00",
          currency: "GBP",
          accountCode: "5100",
          description: "Monthly electricity bill",
          docType: "Bill",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      externalRecordId: "BILL-001",
      emissionCategoryCode: "s2-electricity-lb",
      spendAmount: 2500,
      supplierName: "Acme Energy",
    });
  });

  it("should reject invoices (customer receivables)", async () => {
    const payload = {
      rows: [
        {
          docNumber: "INV-001",
          docDate: "2026-08-15",
          customer: "Acme Corp",
          amount: "5000.00",
          docType: "Invoice",
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow("No valid records found");
  });

  it("should map Scope 1 Fleet fuel correctly", async () => {
    const payload = {
      rows: [
        {
          docNumber: "EXP-001",
          docDate: "2026-08-20",
          vendor: "Shell Fuel",
          amount: "500.00",
          accountCode: "5010",
          description: "Fleet fuel - diesel",
          docType: "Expense",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].emissionCategoryCode).toBe("s1-mobile");
  });

  it("should flag spend-based records with warnings", async () => {
    const payload = {
      rows: [
        {
          docNumber: "BILL-002",
          docDate: "2026-08-25",
          vendor: "Supplier Inc",
          amount: "1000.00",
          accountCode: "6000",
          description: "Materials purchase",
          docType: "Bill",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].validationWarnings).toContain(
      "No physical quantity found in description. Using spend-based fallback."
    );
  });

  it("should handle comma-separated amounts", async () => {
    const payload = {
      rows: [
        {
          docNumber: "BILL-003",
          docDate: "2026-08-01",
          amount: "12,345.67",
          accountCode: "5000",
          docType: "Bill",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].spendAmount).toBe(12345.67);
  });

  it("should use cost center as business unit code", async () => {
    const payload = {
      rows: [
        {
          docNumber: "BILL-004",
          docDate: "2026-08-10",
          amount: "800.00",
          class: "CC-LONDON",
          accountCode: "5000",
          docType: "Bill",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].businessUnitCode).toBe("CC-LONDON");
  });

  it("should throw if no valid records", async () => {
    const payload = {
      rows: [
        {
          docNumber: "",
          docDate: "invalid",
          amount: "invalid",
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow("No valid records found");
  });
});
