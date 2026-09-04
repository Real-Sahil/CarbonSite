import { describe, it, expect } from "vitest";
import { buildSamplingPlan, suggestMaterialityThreshold, type SampleCandidate } from "../sampling";

function candidate(over: Partial<SampleCandidate> & { id: string }): SampleCandidate {
  return {
    activityRecordId: `ar-${over.id}`,
    dataOrigin: "estimated",
    totalCo2e: 10,
    ...over,
  };
}

describe("suggestMaterialityThreshold", () => {
  it("defaults to 5% of the total", () => {
    expect(suggestMaterialityThreshold(1000)).toBe(50);
  });

  it("accepts a custom percentage", () => {
    expect(suggestMaterialityThreshold(1000, 2)).toBe(20);
  });

  it("floors a negative total at zero", () => {
    expect(suggestMaterialityThreshold(-500)).toBe(0);
  });
});

describe("buildSamplingPlan", () => {
  it("tests every record above materiality in full, regardless of target size", () => {
    const candidates = [
      candidate({ id: "big1", totalCo2e: 500 }),
      candidate({ id: "big2", totalCo2e: 600 }),
      candidate({ id: "small", totalCo2e: 5 }),
    ];
    const plan = buildSamplingPlan({
      candidates,
      materialityThresholdCo2e: 100,
      targetSampleSize: 1,
    });
    const fullPop = plan.filter((p) => p.samplingMethod === "full_population");
    expect(fullPop).toHaveLength(2);
    expect(fullPop.map((p) => p.emissionCalculationId).sort()).toEqual(["big1", "big2"]);
  });

  it("prioritises the weakest provenance tiers in the risk-based stratum", () => {
    const candidates = [
      candidate({ id: "metered", dataOrigin: "metered" }),
      candidate({ id: "proxy", dataOrigin: "proxy" }),
      candidate({ id: "extrapolated", dataOrigin: "extrapolated" }),
      candidate({ id: "estimated", dataOrigin: "estimated" }),
    ];
    const plan = buildSamplingPlan({
      candidates,
      materialityThresholdCo2e: 100_000,
      targetSampleSize: 2,
    });
    const riskBased = plan.filter((p) => p.samplingMethod === "risk_based");
    expect(riskBased.map((p) => p.emissionCalculationId)).toEqual(
      expect.arrayContaining(["extrapolated", "proxy"]),
    );
    expect(riskBased.map((p) => p.emissionCalculationId)).not.toContain("metered");
  });

  it("does not select strong-provenance records into the risk-based stratum", () => {
    const candidates = [
      candidate({ id: "metered1", dataOrigin: "metered" }),
      candidate({ id: "invoiced1", dataOrigin: "invoiced" }),
    ];
    const plan = buildSamplingPlan({
      candidates,
      materialityThresholdCo2e: 100_000,
      targetSampleSize: 5,
    });
    expect(plan.filter((p) => p.samplingMethod === "risk_based")).toHaveLength(0);
  });

  it("tops up with a random stratum when risk-based does not fill the target", () => {
    const candidates = [
      candidate({ id: "metered1", dataOrigin: "metered" }),
      candidate({ id: "metered2", dataOrigin: "metered" }),
      candidate({ id: "metered3", dataOrigin: "metered" }),
    ];
    const plan = buildSamplingPlan({
      candidates,
      materialityThresholdCo2e: 100_000,
      targetSampleSize: 2,
    });
    expect(plan).toHaveLength(2);
    expect(plan.every((p) => p.samplingMethod === "random")).toBe(true);
  });

  it("never selects the same calculation twice across strata", () => {
    const candidates = [
      candidate({ id: "big-and-weak", totalCo2e: 500, dataOrigin: "proxy" }),
      candidate({ id: "small1" }),
      candidate({ id: "small2" }),
    ];
    const plan = buildSamplingPlan({
      candidates,
      materialityThresholdCo2e: 100,
      targetSampleSize: 10,
    });
    const ids = plan.map((p) => p.emissionCalculationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not exceed the target sample size when full-population is empty", () => {
    const candidates = Array.from({ length: 20 }, (_, i) => candidate({ id: `c${i}` }));
    const plan = buildSamplingPlan({
      candidates,
      materialityThresholdCo2e: 100_000,
      targetSampleSize: 5,
    });
    expect(plan.length).toBeLessThanOrEqual(5);
  });

  it("gives every selected item a non-empty rationale and test procedure", () => {
    const candidates = [
      candidate({ id: "a", totalCo2e: 500, dataOrigin: "proxy" }),
      candidate({ id: "b" }),
    ];
    const plan = buildSamplingPlan({
      candidates,
      materialityThresholdCo2e: 100,
      targetSampleSize: 5,
    });
    for (const item of plan) {
      expect(item.selectionRationale.length).toBeGreaterThan(10);
      expect(item.testProcedure.length).toBeGreaterThan(10);
    }
  });

  it("produces a reproducible random stratum for the same input", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => candidate({ id: `c${i}` }));
    const plan1 = buildSamplingPlan({ candidates, materialityThresholdCo2e: 100_000, targetSampleSize: 4 });
    const plan2 = buildSamplingPlan({ candidates, materialityThresholdCo2e: 100_000, targetSampleSize: 4 });
    expect(plan1.map((p) => p.emissionCalculationId)).toEqual(plan2.map((p) => p.emissionCalculationId));
  });

  it("returns an empty plan for an empty population", () => {
    const plan = buildSamplingPlan({ candidates: [], materialityThresholdCo2e: 100, targetSampleSize: 5 });
    expect(plan).toEqual([]);
  });
});
