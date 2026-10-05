import { describe, expect, it } from "vitest";
import { recomputeFromFormula } from "../recompute";

describe("recomputeFromFormula", () => {
  const scalar = "235729.76878612716 GBP × 0.231865 kg CO2e/GBP = 54657.482840 kg CO2e";
  it("matches a scalar calculation", () => {
    expect(recomputeFromFormula({ formula: scalar, normalizedAmount: 235729.76878612716, totalCo2e: 54657.48284 }).status).toBe("matches");
  });
  it("catches a stored total that was changed", () => {
    const r = recomputeFromFormula({ formula: scalar, normalizedAmount: 235729.76878612716, totalCo2e: 60000 });
    expect(r.status).toBe("differs");
    expect(r.recomputed).toBeCloseTo(54657.48, 1);
  });
  it("passes a formula amount that was converted or deflated, and says so", () => {
    const r = recomputeFromFormula({ formula: scalar, normalizedAmount: 250000, totalCo2e: 54657.48284 });
    expect(r.status).toBe("matches");
    expect(r.note).toContain("differs from the normalised amount");
  });
  it("catches a formula whose own arithmetic is wrong", () => {
    const bad = "1000 kWh × 0.2 kg CO2e/kWh = 900.000000 kg CO2e";
    expect(recomputeFromFormula({ formula: bad, normalizedAmount: 1000, totalCo2e: 900 }).status).toBe("differs");
  });
  it("checks per-gas formulas with their GWPs", () => {
    const f = "CO2: 100 × 2 = 200.000000 kg; CH4: 100 × 0.01 × 27.9 (GWP) = 27.900000 kg CO2e; N2O: 100 × 0.001 × 273 (GWP) = 27.300000 kg CO2e";
    expect(recomputeFromFormula({ formula: f, normalizedAmount: 100, totalCo2e: 255.2 }).status).toBe("matches");
    expect(recomputeFromFormula({ formula: f, normalizedAmount: 100, totalCo2e: 300 }).status).toBe("differs");
  });
  it("says so when the formula is in a form it does not read", () => {
    expect(recomputeFromFormula({ formula: "no factor found", normalizedAmount: 5, totalCo2e: 0 }).status).toBe("not_checkable");
    expect(recomputeFromFormula({ formula: "", normalizedAmount: 5, totalCo2e: 0 }).status).toBe("not_checkable");
  });
});
