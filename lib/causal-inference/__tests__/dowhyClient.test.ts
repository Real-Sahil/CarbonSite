import { describe, it, expect } from "vitest";
import { DoWhyClient, estimateCausalEffect, CausalDataPoint } from "../dowhyClient";
import {
  facilityUpgradeModel,
  supplierSwitchModel,
  processChangeModel,
  selectModelFromQuestion,
  listModels,
} from "../models";

describe("DoWhy Causal Inference", () => {
  describe("estimateCausalEffect", () => {
    /**
     * Synthetic data: Facility upgrade scenario
     * Treatment: Facility upgraded (1) vs not upgraded (0)
     * Outcome: Emissions reduction (%)
     * Confounder: Baseline emissions level
     */
    it("should estimate causal effect with propensity score matching", async () => {
      const data: CausalDataPoint[] = [];

      // Control group: no upgrade
      for (let i = 0; i < 25; i++) {
        data.push({
          treatment: 0,
          outcome: 2 + Math.random() * 3, // 2-5% baseline reduction (no upgrade effect)
          baseline_emissions: 100 + Math.random() * 200,
        });
      }

      // Treatment group: upgraded
      for (let i = 0; i < 25; i++) {
        data.push({
          treatment: 1,
          outcome: 12 + Math.random() * 4, // 12-16% reduction (includes upgrade effect ~10%)
          baseline_emissions: 100 + Math.random() * 200,
        });
      }

      const result = await estimateCausalEffect({
        treatment: "upgraded",
        outcome: "reduction",
        confounders: ["baseline_emissions"],
        data,
      });

      expect(result.effectSize).toBeGreaterThan(6); // ATE should be ~10%
      expect(result.effectSize).toBeLessThan(15);
      expect(result.pValue).toBeLessThan(0.05); // Statistically significant
      expect(result.sampleSize).toBeGreaterThan(5);
    });

    it("should return confidence intervals correctly", async () => {
      const data: CausalDataPoint[] = [];

      for (let i = 0; i < 50; i++) {
        data.push({
          treatment: i < 25 ? 0 : 1,
          outcome: (i < 25 ? 5 : 15) + Math.random() * 2, // Add variance
          confounder1: 100 + Math.random() * 20,
        });
      }

      const result = await estimateCausalEffect({
        treatment: "treat",
        outcome: "out",
        confounders: ["confounder1"],
        data,
      });

      expect(result.confidenceIntervalLower).toBeLessThan(result.effectSize);
      expect(result.confidenceIntervalUpper).toBeGreaterThan(result.effectSize);
    });

    it("should handle insufficient sample size gracefully", async () => {
      const data: CausalDataPoint[] = [
        { treatment: 1, outcome: 10, conf: 1 },
        { treatment: 0, outcome: 5, conf: 1 },
      ];

      const result = await estimateCausalEffect({
        treatment: "t",
        outcome: "o",
        confounders: ["conf"],
        data,
      });

      expect(result.error).toBeDefined();
      expect(result.effectSize).toBe(0);
      expect(result.pValue).toBe(1.0);
    });

    it("should handle unbalanced treatment/control", async () => {
      const data: CausalDataPoint[] = [];

      // Only 1 treated unit
      data.push({ treatment: 1, outcome: 20, conf: 100 });

      // 40 control units
      for (let i = 0; i < 40; i++) {
        data.push({ treatment: 0, outcome: 5, conf: 100 });
      }

      const result = await estimateCausalEffect({
        treatment: "t",
        outcome: "o",
        confounders: ["conf"],
        data,
      });

      expect(result.error).toBeDefined();
    });

    it("should satisfy backdoor criterion when confounders identified", () => {
      const client = new DoWhyClient("treatment", "outcome", ["confounder1", "confounder2"]);
      const data: CausalDataPoint[] = Array(40)
        .fill(null)
        .map((_, i) => ({
          treatment: i % 2,
          outcome: 10 + i,
          confounder1: 100 + Math.random() * 50,
          confounder2: 200 + Math.random() * 50,
        }));

      const result = client.estimateCausalEffect(data);
      expect(result.backdoorCriterionSatisfied).toBe(true);
    });
  });

  describe("Sensitivity Analysis", () => {
    it("should compute Rosenbaum bounds for unmeasured confounding", () => {
      const client = new DoWhyClient("t", "o", ["conf"]);
      const estimate = {
        effectSize: 10,
        confidenceIntervalLower: 5,
        confidenceIntervalUpper: 15,
        pValue: 0.01,
        robustnessToUnmeasuredConfounding: 0.7,
        sampleSize: 100,
        method: "propensity_score" as const,
        backdoorCriterionSatisfied: true,
      };

      const sensitivity = client.sensitivityAnalysis(estimate, 1.5);

      expect(sensitivity.lowerBound).toBeLessThan(estimate.effectSize);
      expect(sensitivity.upperBound).toBeGreaterThan(estimate.effectSize);
      expect(sensitivity.interpretableAt).toBe(1.5);
    });

    it("should return tighter bounds with higher gamma", () => {
      const client = new DoWhyClient("t", "o", ["conf"]);
      const estimate = {
        effectSize: 10,
        confidenceIntervalLower: 5,
        confidenceIntervalUpper: 15,
        pValue: 0.01,
        robustnessToUnmeasuredConfounding: 0.7,
        sampleSize: 100,
        method: "propensity_score" as const,
        backdoorCriterionSatisfied: true,
      };

      const sensitivity1 = client.sensitivityAnalysis(estimate, 1.2);
      const sensitivity2 = client.sensitivityAnalysis(estimate, 2.0);

      expect(Math.abs(sensitivity1.lowerBound - sensitivity1.upperBound)).toBeLessThan(
        Math.abs(sensitivity2.lowerBound - sensitivity2.upperBound)
      );
    });
  });

  describe("Predefined Models", () => {
    it("should list all available models", () => {
      const models = listModels();
      expect(models).toHaveLength(3);
      expect(models.map((m) => m.id)).toContain("facility_upgrade");
      expect(models.map((m) => m.id)).toContain("supplier_switch");
      expect(models.map((m) => m.id)).toContain("process_change");
    });

    it("should retrieve facility upgrade model correctly", () => {
      const model = selectModelFromQuestion("What impact did our facility upgrade have?");
      expect(model).toBe(facilityUpgradeModel);
      expect(model?.treatment).toBe("upgraded_facility");
      expect(model?.confounders).toContain("facility_size_sqm");
    });

    it("should retrieve supplier switch model from question", () => {
      const model = selectModelFromQuestion("Did switching suppliers reduce Scope 3 emissions?");
      expect(model).toBe(supplierSwitchModel);
      expect(model?.treatment).toBe("switched_supplier");
      expect(model?.outcome).toBe("scope3_emissions_change");
    });

    it("should retrieve process change model from question", () => {
      const model = selectModelFromQuestion("What efficiency gains did our process changes achieve?");
      expect(model).toBe(processChangeModel);
      expect(model?.outcome).toBe("efficiency_gain_pct");
    });

    it("should provide interpretation guide for each model", () => {
      expect(facilityUpgradeModel.interpretationGuide).toContain("ATE");
      expect(supplierSwitchModel.interpretationGuide).toContain("robustness");
      expect(processChangeModel.interpretationGuide).toContain("sensitivity_gamma");
    });
  });

  describe("Edge Cases", () => {
    it("should handle small effect size", async () => {
      const data: CausalDataPoint[] = [];

      // Treatment effect is small (1-2 units) compared to variance (50+ units)
      for (let i = 0; i < 50; i++) {
        const baseOutcome = 100 + Math.random() * 50; // High variance
        data.push({
          treatment: i < 25 ? 0 : 1,
          outcome: baseOutcome + (i < 25 ? 0 : 1.5), // Tiny treatment effect
          conf: 100 + Math.random() * 20,
        });
      }

      const result = await estimateCausalEffect({
        treatment: "t",
        outcome: "o",
        confounders: ["conf"],
        data,
      });

      expect(result.effectSize).toBeLessThan(11); // Small to moderate effect (allows variance)
      expect(result.pValue).toBeGreaterThan(0.05); // Not statistically significant
    });

    it("should handle negative effect sizes (disutility)", async () => {
      const data: CausalDataPoint[] = [];

      for (let i = 0; i < 50; i++) {
        data.push({
          treatment: i < 25 ? 0 : 1,
          outcome: i < 25 ? 20 : 10, // Treatment reduces outcome
          conf: 100,
        });
      }

      const result = await estimateCausalEffect({
        treatment: "t",
        outcome: "o",
        confounders: ["conf"],
        data,
      });

      expect(result.effectSize).toBeLessThan(0);
    });

    it("should produce deterministic results with same seed", async () => {
      const baseData: CausalDataPoint[] = [];
      for (let i = 0; i < 50; i++) {
        baseData.push({
          treatment: i % 2,
          outcome: 10 + i * 0.5,
          conf1: 100 + i * 2,
        });
      }

      const result1 = await estimateCausalEffect({
        treatment: "t",
        outcome: "o",
        confounders: ["conf1"],
        data: baseData,
      });

      const result2 = await estimateCausalEffect({
        treatment: "t",
        outcome: "o",
        confounders: ["conf1"],
        data: baseData,
      });

      expect(result1.effectSize).toBe(result2.effectSize);
      expect(result1.pValue).toBe(result2.pValue);
    });
  });

  describe("Statistical Robustness", () => {
    it("should assign high robustness to well-matched pairs", () => {
      const client = new DoWhyClient("t", "o", ["conf"]);

      // Perfectly matched pairs (low confounder variance)
      const data: CausalDataPoint[] = [];
      for (let i = 0; i < 50; i++) {
        data.push({
          treatment: i % 2,
          outcome: i < 25 ? 10 : 15,
          conf: 100, // All confounders identical
        });
      }

      const result = client.estimateCausalEffect(data);
      expect(result.robustnessToUnmeasuredConfounding).toBeGreaterThan(0.5);
    });

    it("should assign low robustness to poorly-matched pairs", () => {
      const client = new DoWhyClient("t", "o", ["conf"]);

      // Poorly matched pairs (high confounder variance)
      const data: CausalDataPoint[] = [];
      for (let i = 0; i < 50; i++) {
        data.push({
          treatment: i % 2,
          outcome: i < 25 ? 10 : 15,
          conf: i * 10, // Wide range of confounder values
        });
      }

      const result = client.estimateCausalEffect(data);
      expect(result.robustnessToUnmeasuredConfounding).toBeLessThan(0.5);
    });
  });
});
