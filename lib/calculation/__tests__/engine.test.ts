import { describe, it, expect } from "vitest";
import { computeCo2e } from "../engine";

describe("computeCo2e — scalar factor", () => {
  it("computes CO2e from scalar factor", () => {
    const result = computeCo2e(100, "kWh", { co2e: 0.233 }, "kWh");
    expect(result.totalCo2e).toBeCloseTo(23.3);
    expect(result.co2).toBeNull();
    expect(result.ch4).toBeNull();
    expect(result.n2o).toBeNull();
    expect(result.formula).toContain("0.233");
    expect(result.warnings).toHaveLength(0);
  });

  it("warns on unit mismatch", () => {
    const result = computeCo2e(100, "kWh", { co2e: 0.5 }, "kg");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Unit mismatch");
  });
});

describe("computeCo2e — gas-specific factor", () => {
  it("computes CO2e from individual gas factors using AR6 GWP", () => {
    // GWP: CH4 = 27.9, N2O = 273
    const result = computeCo2e(
      1000,
      "kg",
      { co2: 0.0027, ch4: 0.000005, n2o: 0.000000001 },
      "kg",
    );
    const expectedCo2 = 1000 * 0.0027;           // 2.7
    const expectedCh4Co2e = 1000 * 0.000005 * 27.9; // 0.1395
    const expectedN2oCo2e = 1000 * 0.000000001 * 273; // 0.000273
    expect(result.totalCo2e).toBeCloseTo(expectedCo2 + expectedCh4Co2e + expectedN2oCo2e, 4);
    expect(result.co2).toBeCloseTo(expectedCo2);
    expect(result.ch4).toBeCloseTo(1000 * 0.000005);
    expect(result.n2o).toBeCloseTo(1000 * 0.000000001);
    expect(result.formula).toContain("GWP");
  });

  it("handles partial gas breakdown (co2 only)", () => {
    const result = computeCo2e(500, "litre", { co2: 2.3 }, "litre");
    expect(result.totalCo2e).toBeCloseTo(500 * 2.3);
    expect(result.ch4).toBeNull();
    expect(result.n2o).toBeNull();
  });

  it("handles ch4 + n2o without co2", () => {
    const result = computeCo2e(10, "kg", { ch4: 1.0, n2o: 0.01 }, "kg");
    const expectedCo2e = 10 * 1.0 * 27.9 + 10 * 0.01 * 273;
    expect(result.totalCo2e).toBeCloseTo(expectedCo2e);
    expect(result.co2).toBeNull();
  });
});

describe("computeCo2e — edge cases", () => {
  it("throws when factor has no usable values", () => {
    expect(() =>
      computeCo2e(100, "kWh", { co2: null, ch4: null, n2o: null, co2e: null }, "kWh"),
    ).toThrow("no usable values");
  });

  it("accumulates external warnings", () => {
    const result = computeCo2e(1, "kWh", { co2e: 0.1 }, "kWh", ["prior warning"]);
    expect(result.warnings).toContain("prior warning");
  });
});
