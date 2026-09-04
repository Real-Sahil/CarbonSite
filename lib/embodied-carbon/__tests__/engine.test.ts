import { describe, it, expect } from "vitest";
import { calculateEmbodiedCarbon, sumEmbodiedCarbon } from "../engine";

const baseFactors = {
  gwpA1A3: 0.5,
  gwpA4: 0.02,
  gwpA5: 0.01,
  declaredUnit: "kg",
};

describe("calculateEmbodiedCarbon — A stages", () => {
  it("computes A1-A3 only by default", () => {
    const result = calculateEmbodiedCarbon({ quantity: 1000, unit: "kg", factors: baseFactors });
    expect(result.totalKgCo2e).toBeCloseTo(500);
    expect(result.breakdown["A1-A3"]).toBeCloseTo(500);
  });

  it("sums A1-A3, A4 and A5 when all three are requested", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1000,
      unit: "kg",
      factors: baseFactors,
      stages: ["A1-A3", "A4", "A5"],
    });
    expect(result.totalKgCo2e).toBeCloseTo(500 + 20 + 10);
  });

  it("warns and excludes A4 when the factor has no transport value", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1000,
      unit: "kg",
      factors: { gwpA1A3: 0.5, declaredUnit: "kg" },
      stages: ["A1-A3", "A4"],
    });
    expect(result.breakdown.A4).toBeUndefined();
    expect(result.warnings.some((w) => w.includes("A4"))).toBe(true);
  });
});

describe("calculateEmbodiedCarbon — end of life", () => {
  it("uses the lumped C1-C4 factor when requested", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1000,
      unit: "kg",
      factors: { ...baseFactors, gwpC1C4: 0.03 },
      stages: ["A1-A3", "C1-C4"],
    });
    expect(result.breakdown["C1-C4"]).toBeCloseTo(30);
    expect(result.totalKgCo2e).toBeCloseTo(530);
  });

  it("computes granular C1-C4 stages independently", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1000,
      unit: "kg",
      factors: { ...baseFactors, gwpC1: 0.001, gwpC2: 0.002, gwpC3: 0.003, gwpC4: 0.004 },
      stages: ["A1-A3", "C1", "C2", "C3", "C4"],
    });
    expect(result.breakdown.C1).toBeCloseTo(1);
    expect(result.breakdown.C2).toBeCloseTo(2);
    expect(result.breakdown.C3).toBeCloseTo(3);
    expect(result.breakdown.C4).toBeCloseTo(4);
    expect(result.totalKgCo2e).toBeCloseTo(500 + 1 + 2 + 3 + 4);
  });

  it("warns and excludes a granular C stage with no factor value, without affecting the others", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1000,
      unit: "kg",
      factors: { ...baseFactors, gwpC1: 0.001 },
      stages: ["A1-A3", "C1", "C2"],
    });
    expect(result.breakdown.C1).toBeCloseTo(1);
    expect(result.breakdown.C2).toBeUndefined();
    expect(result.warnings.some((w) => w.includes("C2"))).toBe(true);
  });

  it("reports module D separately without special treatment in the total", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1000,
      unit: "kg",
      factors: { ...baseFactors, gwpD: -0.05 },
      stages: ["A1-A3", "D"],
    });
    expect(result.breakdown.D).toBeCloseTo(-50);
    expect(result.totalKgCo2e).toBeCloseTo(450);
  });
});

describe("calculateEmbodiedCarbon — unit conversion", () => {
  it("converts tonnes to kg for a kg-declared material", () => {
    const result = calculateEmbodiedCarbon({ quantity: 2, unit: "tonne", factors: baseFactors });
    expect(result.quantityKg).toBeCloseTo(2000);
    expect(result.totalKgCo2e).toBeCloseTo(1000);
  });

  it("converts m3 to kg using density", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1,
      unit: "m3",
      factors: { ...baseFactors, declaredUnit: "kg", density: 2400 },
    });
    expect(result.quantityKg).toBeCloseTo(2400);
  });

  it("warns when m3→kg conversion has no density set", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1,
      unit: "m3",
      factors: { ...baseFactors, declaredUnit: "kg" },
    });
    expect(result.warnings.some((w) => w.includes("density"))).toBe(true);
  });
});

describe("sumEmbodiedCarbon", () => {
  it("sums totalKgCo2e across multiple results", () => {
    const a = calculateEmbodiedCarbon({ quantity: 100, unit: "kg", factors: baseFactors });
    const b = calculateEmbodiedCarbon({ quantity: 200, unit: "kg", factors: baseFactors });
    expect(sumEmbodiedCarbon([a, b])).toBeCloseTo(a.totalKgCo2e + b.totalKgCo2e);
  });
});
