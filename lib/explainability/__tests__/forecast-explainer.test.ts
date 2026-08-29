import { describe, it, expect } from "vitest";
import { explainForecast, explainAnomaly, explainInvoiceAnomaly } from "../forecast-explainer";

describe("Forecast Explainability Engine", () => {
  describe("explainForecast", () => {
    it("should explain forecast with trend component", () => {
      const historicalValues = [100, 110, 120, 130, 140, 150];
      const forecastValue = 155;
      const trendComponent = 50;
      const seasonalComponent = 0;

      const explanation = explainForecast(
        historicalValues,
        forecastValue,
        trendComponent,
        seasonalComponent,
        "exponential_smoothing"
      );

      expect(explanation).toHaveProperty("forecastValue", forecastValue);
      expect(explanation).toHaveProperty("baselineValue");
      expect(explanation.featureImportance).toHaveLength(2); // Trend + Level
      expect(explanation.featureImportance[0]).toHaveProperty("name");
      expect(explanation.featureImportance[0]).toHaveProperty("contribution");
      expect(explanation.featureImportance[0]).toHaveProperty("direction");
      expect(explanation.summary).toBeTruthy();
    });

    it("should explain forecast with seasonal component", () => {
      const historicalValues = [100, 105, 110, 95, 100, 105, 110, 95, 100, 105, 110, 95];
      const forecastValue = 110;
      const trendComponent = 5;
      const seasonalComponent = 10;

      const explanation = explainForecast(
        historicalValues,
        forecastValue,
        trendComponent,
        seasonalComponent,
        "seasonal_decomposition"
      );

      expect(explanation.featureImportance.length).toBeGreaterThan(0);
      const seasonalFactor = explanation.featureImportance.find((f) => f.name === "Seasonality");
      expect(seasonalFactor).toBeTruthy();
    });

    it("should correctly calculate confidence factors", () => {
      const historicalValues = [100, 102, 101, 103, 100, 102, 101, 103];
      const forecastValue = 102;

      const explanation = explainForecast(
        historicalValues,
        forecastValue,
        1,
        0,
        "exponential_smoothing"
      );

      expect(explanation.confidenceFactors.dataQuality).toBeGreaterThan(0);
      expect(explanation.confidenceFactors.dataQuality).toBeLessThanOrEqual(1);
      expect(explanation.confidenceFactors.volatility).toBeGreaterThan(0);
      expect(explanation.confidenceFactors.volatility).toBeLessThanOrEqual(1);
    });
  });

  describe("explainAnomaly", () => {
    it("should detect normal values as non-anomalies", () => {
      const baseline = [100, 102, 101, 99, 100, 101, 102, 100];
      const value = 101;

      const explanation = explainAnomaly(value, baseline, "zscore");

      expect(explanation.isAnomaly).toBe(false);
      expect(explanation.anomalyScore).toBeLessThan(0.5);
    });

    it("should detect outliers as anomalies", () => {
      const baseline = [100, 102, 101, 99, 100, 101, 102, 100];
      const value = 500;

      const explanation = explainAnomaly(value, baseline, "zscore");

      expect(explanation.isAnomaly).toBe(true);
      expect(explanation.anomalyScore).toBeGreaterThan(0.5);
      expect(explanation.primaryReasons.length).toBeGreaterThan(0);
    });

    it("should explain statistical basis for anomalies", () => {
      const baseline = [95, 100, 105, 98, 102, 100, 99, 101, 100, 98];
      const value = 300;

      const explanation = explainAnomaly(value, baseline, "zscore");

      expect(explanation.statisticalBasis.zscore).toBeGreaterThan(0);
      expect(explanation.statisticalBasis.baselineValue).toBeCloseTo(100, 0);
      expect(explanation.statisticalBasis.outlierMultiplier).toBeGreaterThan(2);
    });

    it("should categorize temporal trends", () => {
      const baseline = [100, 110, 120, 130, 140, 150];
      const value = 155;

      const explanation = explainAnomaly(value, baseline, "zscore");

      expect(["increasing", "decreasing", "stable"]).toContain(
        explanation.contextualFactors.temporalTrend
      );
    });
  });

  describe("explainInvoiceAnomaly", () => {
    it("should detect overbilling anomalies", () => {
      const invoice = {
        amount: 1000,
        quantityInvoiced: 100,
        quantityReceived: 50,
        invoiceDate: new Date("2026-01-01"),
        receivedDate: new Date("2026-01-01"),
        vendorHistoricalAmount: 900,
        vendorCount: 10,
      };

      const historicalInvoices = Array(10)
        .fill(null)
        .map((_, i) => ({ amount: 900 + i * 10, date: new Date("2025-12-01") }));

      const explanation = explainInvoiceAnomaly(invoice, historicalInvoices);

      expect(explanation.isAnomaly).toBe(true);
      const overbillingReason = explanation.primaryReasons.find(
        (r) => r.name.includes("Quantity")
      );
      expect(overbillingReason).toBeTruthy();
    });

    it("should detect price spike anomalies", () => {
      const invoice = {
        amount: 2000,
        quantityInvoiced: 100,
        quantityReceived: 100,
        invoiceDate: new Date("2026-01-01"),
        receivedDate: new Date("2026-01-01"),
        vendorHistoricalAmount: 1000,
        vendorCount: 20,
      };

      const historicalInvoices = Array(20)
        .fill(null)
        .map((_, i) => ({ amount: 950 + i * 5, date: new Date("2025-12-01") }));

      const explanation = explainInvoiceAnomaly(invoice, historicalInvoices);

      expect(explanation.isAnomaly).toBe(true);
      const priceReason = explanation.primaryReasons.find((r) => r.name.includes("Price"));
      expect(priceReason).toBeTruthy();
    });

    it("should detect date inconsistency anomalies", () => {
      const invoice = {
        amount: 1000,
        quantityInvoiced: 100,
        quantityReceived: 100,
        invoiceDate: new Date("2026-02-01"), // 31 days after receipt
        receivedDate: new Date("2026-01-01"),
        vendorHistoricalAmount: 1000,
        vendorCount: 15,
      };

      const historicalInvoices = Array(15)
        .fill(null)
        .map((_, i) => ({ amount: 990 + i, date: new Date("2025-12-01") }));

      const explanation = explainInvoiceAnomaly(invoice, historicalInvoices);

      expect(explanation.isAnomaly).toBe(true);
      const dateReason = explanation.primaryReasons.find((r) => r.name.includes("Date"));
      expect(dateReason).toBeTruthy();
    });

    it("should handle vendor baseline comparison", () => {
      const invoice = {
        amount: 1000,
        quantityInvoiced: 100,
        quantityReceived: 100,
        invoiceDate: new Date("2026-01-01"),
        receivedDate: new Date("2026-01-01"),
        vendorHistoricalAmount: 1000,
        vendorCount: 5,
      };

      const historicalInvoices = [
        { amount: 950, date: new Date("2025-12-01") },
        { amount: 1000, date: new Date("2025-11-01") },
        { amount: 1050, date: new Date("2025-10-01") },
      ];

      const explanation = explainInvoiceAnomaly(invoice, historicalInvoices);

      expect(explanation.isAnomaly).toBe(false);
      expect(explanation.anomalyScore).toBeLessThan(0.5);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty historical data", () => {
      const explanation = explainAnomaly(100, [], "zscore");

      expect(explanation).toBeDefined();
      expect(explanation.isAnomaly).toBe(false);
      expect(explanation.statisticalBasis.zscore).toBe(0);
    });

    it("should handle single data point", () => {
      const explanation = explainForecast([100], 105, 5, 0, "exponential_smoothing");

      expect(explanation).toBeDefined();
      expect(explanation.baselineValue).toBe(100);
    });

    it("should handle zero standard deviation", () => {
      const baseline = [100, 100, 100, 100];
      const explanation = explainAnomaly(100, baseline, "zscore");

      expect(explanation).toBeDefined();
      expect(explanation.statisticalBasis.baselineStdDev).toBe(0);
      expect(explanation.isAnomaly).toBe(false);
    });
  });
});
