import { describe, it, expect } from "vitest";
import {
  analyzeFeatureContributions,
  generateForecastSummary,
  decomposeTimeSeries,
  calculateConfidenceFactors,
  generateForecastExplanation,
} from "../forecast-explainability";

describe("forecast-explainability", () => {
  describe("analyzeFeatureContributions", () => {
    it("should calculate feature contributions correctly", () => {
      const forecast = 1250;
      const historical = 1000;
      const features = {
        trend: 50,
        seasonality: 100,
        recentChange: 50,
        volatility: 15,
      };

      const contributions = analyzeFeatureContributions(forecast, historical, features);

      expect(contributions).toHaveLength(4);
      expect(contributions[0]).toHaveProperty("name");
      expect(contributions[0]).toHaveProperty("contribution");
      expect(contributions[0]).toHaveProperty("direction");
      expect(contributions[0]).toHaveProperty("significance");
      expect(contributions[0]).toHaveProperty("explanation");
    });

    it("should rank contributions by absolute value", () => {
      const contributions = analyzeFeatureContributions(1500, 1000, {
        trend: 200,
        seasonality: 10,
        recentChange: 5,
      });

      expect(contributions[0].name).toBe("Trend");
      expect(contributions[1].name).toBe("Seasonality");
      expect(contributions[2].name).toBe("Recent Change");
    });

    it("should calculate direction correctly", () => {
      const positiveContribution = analyzeFeatureContributions(1500, 1000, {
        trend: 100,
      });

      expect(positiveContribution[0].direction).toBe("positive");

      const negativeContribution = analyzeFeatureContributions(500, 1000, {
        trend: -100,
      });

      expect(negativeContribution[0].direction).toBe("negative");
    });
  });

  describe("generateForecastSummary", () => {
    it("should generate summary for stable forecast", () => {
      const summary = generateForecastSummary(1020, 1000, 50, [], 80, "ARIMA");

      expect(summary).toContain("stable");
      expect(summary).toContain("2");
    });

    it("should generate summary for increasing forecast", () => {
      const summary = generateForecastSummary(1500, 1000, 50, [], 85, "Prophet");

      expect(summary).toContain("increase");
      expect(summary).toContain("50");
    });

    it("should generate summary for decreasing forecast", () => {
      const summary = generateForecastSummary(500, 1000, 50, [], 75, "Exponential Smoothing");

      expect(summary).toContain("decrease");
      expect(summary).toContain("50");
    });

    it("should include confidence level based on accuracy", () => {
      const highConfidence = generateForecastSummary(1500, 1000, 50, [], 90, "Model");
      expect(highConfidence).toContain("high confidence");

      const mediumConfidence = generateForecastSummary(1500, 1000, 50, [], 75, "Model");
      expect(mediumConfidence).toContain("moderate confidence");

      const lowConfidence = generateForecastSummary(1500, 1000, 50, [], 60, "Model");
      expect(lowConfidence).toContain("lower confidence");
    });
  });

  describe("decomposeTimeSeries", () => {
    it("should decompose time series into components", () => {
      const values = Array.from({ length: 36 }, (_, i) => 1000 + Math.sin(i / 12) * 200);
      const components = decomposeTimeSeries(values, 12);

      expect(components).toHaveProperty("trend");
      expect(components).toHaveProperty("seasonal");
      expect(components).toHaveProperty("residual");
    });

    it("should handle insufficient data", () => {
      const shortValues = [100, 200, 300];
      const components = decomposeTimeSeries(shortValues, 12);

      expect(components.trend).toBe(0);
      expect(components.seasonal).toBe(0);
      expect(components.residual).toBe(0);
    });

    it("should return percentages", () => {
      const values = Array.from({ length: 24 }, (_, i) => 1000);
      const components = decomposeTimeSeries(values, 12);

      // With constant values, components should be near 0
      expect(typeof components.trend).toBe("number");
      expect(typeof components.seasonal).toBe("number");
      expect(typeof components.residual).toBe("number");
    });
  });

  describe("calculateConfidenceFactors", () => {
    it("should calculate all confidence factors", () => {
      const factors = calculateConfidenceFactors(
        [{ confidence: 0.8 }, { confidence: 0.9 }],
        500,
        10,
        15
      );

      expect(factors).toHaveProperty("predictionConfidence");
      expect(factors).toHaveProperty("dataRecency");
      expect(factors).toHaveProperty("trainingData");
      expect(factors).toHaveProperty("volatilityStability");
      expect(factors).toHaveProperty("overallConfidence");
    });

    it("should cap training data factor at 100", () => {
      const factors = calculateConfidenceFactors([], 2000, 0, 5);

      expect(factors.trainingData).toBeLessThanOrEqual(100);
    });

    it("should penalize high volatility", () => {
      const lowVolatility = calculateConfidenceFactors([], 500, 0, 5);
      const highVolatility = calculateConfidenceFactors([], 500, 0, 40);

      expect(highVolatility.volatilityStability).toBeLessThan(lowVolatility.volatilityStability);
    });

    it("should account for data recency", () => {
      const recent = calculateConfidenceFactors([], 500, 5, 10);
      const stale = calculateConfidenceFactors([], 500, 100, 10);

      expect(recent.dataRecency).toBeGreaterThan(stale.dataRecency);
    });
  });

  describe("generateForecastExplanation", () => {
    it("should generate comprehensive explanation", () => {
      const explanation = generateForecastExplanation(
        1250,
        1000,
        100,
        500,
        85,
        "Prophet",
        10,
        15,
        {
          trend: 50,
          seasonality: 100,
          recentChange: 25,
        },
        [{ confidence: 0.85 }]
      );

      expect(explanation).toHaveProperty("summary");
      expect(explanation).toHaveProperty("components");
      expect(explanation).toHaveProperty("featureImportance");
      expect(explanation).toHaveProperty("confidenceFactors");

      expect(explanation.summary).toBeTruthy();
      expect(Array.isArray(explanation.featureImportance)).toBe(true);
      expect(typeof explanation.confidenceFactors.overallConfidence).toBe("number");
    });

    it("should include trend in feature importance", () => {
      const explanation = generateForecastExplanation(
        1250,
        1000,
        100,
        500,
        85,
        "Prophet",
        10,
        15,
        { trend: 50 },
        []
      );

      const trendFeature = explanation.featureImportance.find((f) => f.name === "Trend");
      expect(trendFeature).toBeTruthy();
      expect(trendFeature?.direction).toBe("positive");
    });

    it("should reflect high confidence in summary", () => {
      const explanation = generateForecastExplanation(
        1250,
        1000,
        100,
        1000,
        95,
        "Prophet",
        5,
        10,
        { trend: 50 },
        [{ confidence: 0.95 }]
      );

      expect(explanation.summary).toContain("high confidence");
    });
  });
});
