import { describe, it, expect } from "vitest";
import { CorporateCardsConnector } from "../corporate-cards-connector";

describe("CorporateCardsConnector", () => {
  const connector = new CorporateCardsConnector();

  it("should parse valid airfare transactions", async () => {
    const payload = {
      rows: [
        {
          transactionId: "TXN-001",
          transactionDate: "2026-08-15",
          merchant: "British Airways",
          category: "airfare",
          amount: "500.00",
          currency: "GBP",
          employeeName: "Jane Doe",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      externalRecordId: "TXN-001",
      emissionCategoryCode: "s3-business-travel",
      spendAmount: 500,
      spendCurrency: "GBP",
      transportMode: "flight",
    });
  });

  it("should map card categories to emission categories", async () => {
    const categoryTests = [
      { category: "airfare", expected: "s3-business-travel" },
      { category: "hotel", expected: "s3-business-travel" },
      { category: "car_rental", expected: "s3-business-travel" },
      { category: "fuel", expected: "s1-mobile" },
      { category: "restaurant", expected: "s3-purchased-goods" },
    ];

    for (const test of categoryTests) {
      const payload = {
        rows: [
          {
            transactionId: `TXN-${test.category}`,
            transactionDate: "2026-08-01",
            merchant: "Test Merchant",
            category: test.category as any,
            amount: "100.00",
          },
        ],
      };

      const result = await connector.ingest(payload);
      expect(result.records[0].emissionCategoryCode).toBe(test.expected);
    }
  });

  it("should override category based on merchant keywords", async () => {
    const payload = {
      rows: [
        {
          transactionId: "TXN-002",
          transactionDate: "2026-08-20",
          merchant: "EasyJet Flight Booking",
          category: "other", // Category says "other" but merchant says airline
          amount: "200.00",
        },
      ],
    };

    const result = await connector.ingest(payload);

    // Merchant keyword should override to business travel
    expect(result.records[0].emissionCategoryCode).toBe("s3-business-travel");
  });

  it("should flag restaurant expenses with warning", async () => {
    const payload = {
      rows: [
        {
          transactionId: "TXN-003",
          transactionDate: "2026-08-25",
          merchant: "Ritz Restaurant",
          category: "restaurant",
          amount: "150.00",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].validationWarnings).toContain(
      "Restaurant/catering spend allocated to Scope 3 Purchased Goods. Review if employee meal or business catering."
    );
  });

  it("should warn all card transactions are spend-based", async () => {
    const payload = {
      rows: [
        {
          transactionId: "TXN-004",
          transactionDate: "2026-08-10",
          merchant: "Airlines Ltd",
          category: "airfare",
          amount: "600.00",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].validationWarnings).toContain(
      "Card transactions use spend-based emission factors. Physical quantity data would improve accuracy."
    );
  });

  it("should handle dates in DD/MM/YYYY format", async () => {
    const payload = {
      rows: [
        {
          transactionId: "TXN-005",
          transactionDate: "15/08/2026",
          merchant: "Test",
          category: "hotel",
          amount: "100.00",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].activityDate?.getDate()).toBe(15);
    expect(result.records[0].activityDate?.getMonth()).toBe(7);
  });

  it("should parse amounts with currency symbols and commas", async () => {
    const payload = {
      rows: [
        {
          transactionId: "TXN-006",
          transactionDate: "2026-08-01",
          merchant: "Test",
          category: "airfare",
          amount: "$1,234.56",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].spendAmount).toBe(1234.56);
  });

  it("should detect international transactions", async () => {
    const payload = {
      rows: [
        {
          transactionId: "TXN-007",
          transactionDate: "2026-08-15",
          merchant: "Paris Hotel USA Inc",
          category: "hotel",
          amount: "300.00",
          currency: "USD",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].region).toBe("International");
  });

  it("should reject empty transaction IDs", async () => {
    const payload = {
      rows: [
        {
          transactionId: "",
          transactionDate: "2026-08-01",
          merchant: "Test",
          category: "airfare",
          amount: "100.00",
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow("No valid records found");
  });

  it("should reject zero or negative amounts", async () => {
    const payload = {
      rows: [
        {
          transactionId: "TXN-008",
          transactionDate: "2026-08-01",
          merchant: "Test",
          category: "airfare",
          amount: "0",
        },
      ],
    };

    await expect(connector.ingest(payload)).rejects.toThrow("No valid records found");
  });

  it("should store booking reference as facility code", async () => {
    const payload = {
      rows: [
        {
          transactionId: "TXN-009",
          transactionDate: "2026-08-20",
          merchant: "Airlines Ltd",
          category: "airfare",
          amount: "450.00",
          reference: "AA123456",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].facilityCode).toBe("AA123456");
  });

  it("should infer transport mode from category", async () => {
    const payload = {
      rows: [
        {
          transactionId: "TXN-010",
          transactionDate: "2026-08-01",
          merchant: "Hertz Car Rental",
          category: "car_rental",
          amount: "75.00",
        },
      ],
    };

    const result = await connector.ingest(payload);

    expect(result.records[0].transportMode).toBe("car");
  });
});
