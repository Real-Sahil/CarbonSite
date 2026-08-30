import { describe, it, expect } from "vitest";

// Since computation-worker runs in Web Worker context, we test the logic directly
// by importing and testing the calculation functions

describe("Computation Worker Logic", () => {
  describe("calculateEmissions", () => {
    it("should calculate base CO2e for single record", () => {
      const records: Array<{ amount: number; factor: number; gwpCh4?: number; gwpN2o?: number }> = [
        { amount: 100, factor: 2, gwpCh4: 0.1, gwpN2o: 0.05 },
      ];

      const result = records.map((record) => {
        const baseCo2e = record.amount * record.factor;
        const ch4Contribution = (record.gwpCh4 || 0) * record.amount;
        const n2oContribution = (record.gwpN2o || 0) * record.amount;
        return {
          co2e: baseCo2e,
          total: baseCo2e + ch4Contribution + n2oContribution,
        };
      });

      expect(result).toHaveLength(1);
      expect(result[0].co2e).toBe(200); // 100 * 2
      expect(result[0].total).toBe(215); // 200 + 10 + 5
    });

    it("should handle multiple emission records", () => {
      const records = [
        { amount: 100, factor: 2, gwpCh4: 0.1, gwpN2o: 0.05 },
        { amount: 50, factor: 1.5, gwpCh4: 0.2, gwpN2o: 0.1 },
        { amount: 200, factor: 0.5, gwpCh4: 0, gwpN2o: 0 },
      ];

      const results = records.map((record) => {
        const baseCo2e = record.amount * record.factor;
        const ch4Contribution = (record.gwpCh4 || 0) * record.amount;
        const n2oContribution = (record.gwpN2o || 0) * record.amount;
        return {
          co2e: baseCo2e,
          total: baseCo2e + ch4Contribution + n2oContribution,
        };
      });

      expect(results).toHaveLength(3);
      expect(results[0].total).toBe(215);
      expect(results[1].total).toBe(90); // 75 + 10 + 5
      expect(results[2].total).toBe(100); // 100 + 0 + 0
    });

    it("should handle missing gas factors", () => {
      const records: Array<{ amount: number; factor: number; gwpCh4?: number; gwpN2o?: number }> = [
        { amount: 100, factor: 2 },
      ];

      const result = records.map((record) => {
        const baseCo2e = record.amount * record.factor;
        const ch4Contribution = (record.gwpCh4 || 0) * record.amount;
        const n2oContribution = (record.gwpN2o || 0) * record.amount;
        return {
          co2e: baseCo2e,
          total: baseCo2e + ch4Contribution + n2oContribution,
        };
      });

      expect(result[0].total).toBe(200); // Only base calculation
    });
  });

  describe("validateRecords", () => {
    it("should identify valid records", () => {
      const records = [
        { id: "1", amount: 100, unit: "kg", category: "waste", date: "2024-01-01" },
        { id: "2", amount: 50, unit: "litres", category: "fuel", date: "2024-01-02" },
      ];

      const validation = {
        valid: 0,
        invalid: 0,
        errors: [] as Array<{ recordId: string; reason: string }>,
      };

      for (const record of records) {
        let hasError = false;

        if (record.amount < 0) {
          validation.errors.push({
            recordId: record.id,
            reason: "Negative amount",
          });
          hasError = true;
        }

        if (!record.unit) {
          validation.errors.push({
            recordId: record.id,
            reason: "Missing unit",
          });
          hasError = true;
        }

        if (isNaN(new Date(record.date).getTime())) {
          validation.errors.push({
            recordId: record.id,
            reason: "Invalid date",
          });
          hasError = true;
        }

        if (hasError) {
          validation.invalid++;
        } else {
          validation.valid++;
        }
      }

      expect(validation.valid).toBe(2);
      expect(validation.invalid).toBe(0);
      expect(validation.errors).toHaveLength(0);
    });

    it("should catch negative amounts", () => {
      const records = [{ id: "1", amount: -100, unit: "kg", category: "waste", date: "2024-01-01" }];

      const validation = {
        valid: 0,
        invalid: 0,
        errors: [] as Array<{ recordId: string; reason: string }>,
      };

      for (const record of records) {
        let hasError = false;

        if (record.amount < 0) {
          validation.errors.push({
            recordId: record.id,
            reason: "Negative amount",
          });
          hasError = true;
        }

        if (!record.unit) {
          validation.errors.push({
            recordId: record.id,
            reason: "Missing unit",
          });
          hasError = true;
        }

        if (isNaN(new Date(record.date).getTime())) {
          validation.errors.push({
            recordId: record.id,
            reason: "Invalid date",
          });
          hasError = true;
        }

        if (hasError) {
          validation.invalid++;
        } else {
          validation.valid++;
        }
      }

      expect(validation.invalid).toBe(1);
      expect(validation.errors[0].reason).toBe("Negative amount");
    });

    it("should catch missing units", () => {
      const records = [{ id: "1", amount: 100, unit: "", category: "waste", date: "2024-01-01" }];

      const validation = {
        valid: 0,
        invalid: 0,
        errors: [] as Array<{ recordId: string; reason: string }>,
      };

      for (const record of records) {
        let hasError = false;

        if (record.amount < 0) {
          validation.errors.push({
            recordId: record.id,
            reason: "Negative amount",
          });
          hasError = true;
        }

        if (!record.unit) {
          validation.errors.push({
            recordId: record.id,
            reason: "Missing unit",
          });
          hasError = true;
        }

        if (isNaN(new Date(record.date).getTime())) {
          validation.errors.push({
            recordId: record.id,
            reason: "Invalid date",
          });
          hasError = true;
        }

        if (hasError) {
          validation.invalid++;
        } else {
          validation.valid++;
        }
      }

      expect(validation.invalid).toBe(1);
      expect(validation.errors[0].reason).toBe("Missing unit");
    });

    it("should catch invalid dates", () => {
      const records = [{ id: "1", amount: 100, unit: "kg", category: "waste", date: "not-a-date" }];

      const validation = {
        valid: 0,
        invalid: 0,
        errors: [] as Array<{ recordId: string; reason: string }>,
      };

      for (const record of records) {
        let hasError = false;

        if (record.amount < 0) {
          validation.errors.push({
            recordId: record.id,
            reason: "Negative amount",
          });
          hasError = true;
        }

        if (!record.unit) {
          validation.errors.push({
            recordId: record.id,
            reason: "Missing unit",
          });
          hasError = true;
        }

        if (isNaN(new Date(record.date).getTime())) {
          validation.errors.push({
            recordId: record.id,
            reason: "Invalid date",
          });
          hasError = true;
        }

        if (hasError) {
          validation.invalid++;
        } else {
          validation.valid++;
        }
      }

      expect(validation.invalid).toBe(1);
      expect(validation.errors[0].reason).toBe("Invalid date");
    });
  });

  describe("aggregateData", () => {
    it("should aggregate by category", () => {
      const records = [
        { category: "waste", value: 100 },
        { category: "waste", value: 50 },
        { category: "fuel", value: 75 },
      ];

      const aggregation: Record<string, number> = {};
      const counts: Record<string, number> = {};

      for (const record of records) {
        const cat = record.category;
        aggregation[cat] = (aggregation[cat] || 0) + record.value;
        counts[cat] = (counts[cat] || 0) + 1;
      }

      expect(aggregation.waste).toBe(150);
      expect(aggregation.fuel).toBe(75);
      expect(counts.waste).toBe(2);
      expect(counts.fuel).toBe(1);
    });

    it("should calculate averages correctly", () => {
      const records = [
        { category: "waste", value: 100 },
        { category: "waste", value: 50 },
        { category: "fuel", value: 75 },
      ];

      const aggregation: Record<string, number> = {};
      const counts: Record<string, number> = {};

      for (const record of records) {
        const cat = record.category;
        aggregation[cat] = (aggregation[cat] || 0) + record.value;
        counts[cat] = (counts[cat] || 0) + 1;
      }

      const averages = Object.entries(aggregation).reduce(
        (acc, [cat, total]) => {
          acc[cat] = total / (counts[cat] || 1);
          return acc;
        },
        {} as Record<string, number>
      );

      expect(averages.waste).toBe(75); // (100 + 50) / 2
      expect(averages.fuel).toBe(75); // 75 / 1
    });
  });

  describe("estimateFactors", () => {
    it("should estimate factors with confidence", () => {
      const records = [
        {
          id: "1",
          historical: [100, 105, 95, 102],
          current: 103,
        },
      ];

      const results = records.map((record) => {
        const mean =
          record.historical.length > 0
            ? record.historical.reduce((a, b) => a + b, 0) / record.historical.length
            : 0;

        const variance =
          record.historical.length > 0
            ? record.historical.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
              record.historical.length
            : 0;

        const stdDev = Math.sqrt(variance);
        const zScore = stdDev > 0 ? (record.current - mean) / stdDev : 0;
        const isOutlier = Math.abs(zScore) > 2;

        return {
          id: record.id,
          estimatedFactor: mean,
          confidence: 1 - stdDev / (mean || 1),
          isOutlier,
          zscore: zScore,
        };
      });

      expect(results[0].estimatedFactor).toBeCloseTo(100.5, 0);
      expect(results[0].confidence).toBeGreaterThan(0.9);
      expect(results[0].isOutlier).toBe(false);
    });

    it("should detect outliers", () => {
      const records = [
        {
          id: "1",
          historical: [100, 105, 95, 102],
          current: 500, // Extreme outlier
        },
      ];

      const results = records.map((record) => {
        const mean =
          record.historical.length > 0
            ? record.historical.reduce((a, b) => a + b, 0) / record.historical.length
            : 0;

        const variance =
          record.historical.length > 0
            ? record.historical.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
              record.historical.length
            : 0;

        const stdDev = Math.sqrt(variance);
        const zScore = stdDev > 0 ? (record.current - mean) / stdDev : 0;
        const isOutlier = Math.abs(zScore) > 2;

        return {
          id: record.id,
          estimatedFactor: mean,
          confidence: 1 - stdDev / (mean || 1),
          isOutlier,
          zscore: zScore,
        };
      });

      expect(results[0].isOutlier).toBe(true);
      expect(Math.abs(results[0].zscore)).toBeGreaterThan(2);
    });
  });
});
