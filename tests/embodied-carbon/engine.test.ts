import { describe, it, expect } from "vitest";
import { calculateEmbodiedCarbon, sumEmbodiedCarbon } from "@/lib/embodied-carbon/engine";

// Reference values from ICE Database v3.0 and RICS Professional Statement 2017
const CONCRETE_FACTORS = {
  gwpA1A3: 0.11,   // kgCO2e/kg — ready mix concrete 25MPa
  gwpA4: 0.006,
  declaredUnit: "kg" as const,
  density: 2400,   // kg/m3
};

const STEEL_FACTORS = {
  gwpA1A3: 1.77,   // kgCO2e/kg — structural steel, virgin
  gwpA4: 0.020,
  declaredUnit: "kg" as const,
};

const TIMBER_FACTORS = {
  gwpA1A3: 0.263,  // kgCO2e/kg — sawn softwood, kiln dried
  gwpA4: 0.015,
  declaredUnit: "kg" as const,
  density: 470,
};

const GLASS_FACTORS = {
  gwpA1A3: 28.0,   // kgCO2e/m2 — double-glazed unit
  declaredUnit: "m2" as const,
};

describe("calculateEmbodiedCarbon — A1-A3 only (default)", () => {
  it("concrete: 1000 kg → 110 kgCO2e", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1000,
      unit: "kg",
      factors: CONCRETE_FACTORS,
    });
    expect(result.totalKgCo2e).toBeCloseTo(110, 2);
    expect(result.warnings).toHaveLength(0);
    expect(result.breakdown["A1-A3"]).toBeCloseTo(110, 2);
  });

  it("steel: 500 kg → 885 kgCO2e", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 500,
      unit: "kg",
      factors: STEEL_FACTORS,
    });
    expect(result.totalKgCo2e).toBeCloseTo(885, 1);
  });

  it("timber: 1 tonne → 263 kgCO2e (unit conversion)", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1,
      unit: "tonne",
      factors: TIMBER_FACTORS,
    });
    // 1 tonne = 1000 kg; 1000 * 0.263 = 263
    expect(result.quantityKg).toBe(1000);
    expect(result.totalKgCo2e).toBeCloseTo(263, 1);
    expect(result.warnings).toHaveLength(0);
  });

  it("concrete: 1 m3 via density conversion (2400 kg/m3)", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1,
      unit: "m3",
      factors: CONCRETE_FACTORS,
    });
    // 1 m3 × 2400 kg/m3 × 0.11 kgCO2e/kg = 264 kgCO2e
    expect(result.quantityKg).toBeCloseTo(2400, 0);
    expect(result.totalKgCo2e).toBeCloseTo(264, 1);
  });

  it("glass: 10 m2 double-glazed unit", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 10,
      unit: "m2",
      factors: GLASS_FACTORS,
    });
    // 10 m2 × 28.0 kgCO2e/m2 = 280 kgCO2e
    expect(result.totalKgCo2e).toBeCloseTo(280, 1);
  });
});

describe("calculateEmbodiedCarbon — A1-A3 + A4 (transport included)", () => {
  it("concrete 1000 kg with A4 transport", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1000,
      unit: "kg",
      factors: CONCRETE_FACTORS,
      stages: ["A1-A3", "A4"],
    });
    // A1-A3: 110; A4: 0.006 × 1000 = 6 → total 116
    expect(result.breakdown["A1-A3"]).toBeCloseTo(110, 2);
    expect(result.breakdown["A4"]).toBeCloseTo(6, 2);
    expect(result.totalKgCo2e).toBeCloseTo(116, 1);
  });

  it("steel 500 kg with A4", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 500,
      unit: "kg",
      factors: STEEL_FACTORS,
      stages: ["A1-A3", "A4"],
    });
    // A1-A3: 885; A4: 0.020 × 500 = 10 → total 895
    expect(result.totalKgCo2e).toBeCloseTo(895, 1);
  });
});

describe("calculateEmbodiedCarbon — warnings", () => {
  it("warns when A4 stage requested but factor missing", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 100,
      unit: "kg",
      factors: { gwpA1A3: 0.11, declaredUnit: "kg" }, // no gwpA4
      stages: ["A1-A3", "A4"],
    });
    expect(result.warnings.some((w) => w.includes("A4"))).toBe(true);
    // Only A1-A3 contributes
    expect(result.totalKgCo2e).toBeCloseTo(11, 2);
  });

  it("warns when m3 requested but no density set", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 1,
      unit: "m3",
      factors: { gwpA1A3: 1.77, declaredUnit: "kg" }, // no density
    });
    expect(result.warnings.some((w) => w.includes("density"))).toBe(true);
    // Falls back to using quantity as-is
    expect(result.quantityKg).toBe(1);
  });

  it("formula string is non-empty", () => {
    const result = calculateEmbodiedCarbon({
      quantity: 100,
      unit: "kg",
      factors: CONCRETE_FACTORS,
    });
    expect(result.formula).toContain("kgCO2e");
    expect(result.formula.length).toBeGreaterThan(10);
  });
});

describe("sumEmbodiedCarbon", () => {
  it("sums totals across multiple results", () => {
    const a = calculateEmbodiedCarbon({ quantity: 1000, unit: "kg", factors: CONCRETE_FACTORS });
    const b = calculateEmbodiedCarbon({ quantity: 500, unit: "kg", factors: STEEL_FACTORS });
    // 110 + 885 = 995
    expect(sumEmbodiedCarbon([a, b])).toBeCloseTo(995, 1);
  });

  it("returns 0 for empty array", () => {
    expect(sumEmbodiedCarbon([])).toBe(0);
  });
});

describe("calculateEmbodiedCarbon — industry benchmarks (ICE v3.0)", () => {
  it("reinforcing bar (recycled) is significantly lower than virgin structural steel", () => {
    const rebar = calculateEmbodiedCarbon({
      quantity: 1000,
      unit: "kg",
      factors: { gwpA1A3: 0.55, declaredUnit: "kg" },
    });
    const virgin = calculateEmbodiedCarbon({
      quantity: 1000,
      unit: "kg",
      factors: STEEL_FACTORS,
    });
    expect(rebar.totalKgCo2e).toBeLessThan(virgin.totalKgCo2e);
    // rebar should be ~31% of virgin
    expect(rebar.totalKgCo2e / virgin.totalKgCo2e).toBeLessThan(0.4);
  });

  it("CLT (0.437) lower than EPS insulation (3.29) per kg", () => {
    const clt = calculateEmbodiedCarbon({
      quantity: 1,
      unit: "kg",
      factors: { gwpA1A3: 0.437, declaredUnit: "kg" },
    });
    const eps = calculateEmbodiedCarbon({
      quantity: 1,
      unit: "kg",
      factors: { gwpA1A3: 3.29, declaredUnit: "kg" },
    });
    expect(clt.totalKgCo2e).toBeLessThan(eps.totalKgCo2e);
  });
});
