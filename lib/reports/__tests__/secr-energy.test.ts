import { describe, expect, it } from "vitest";
import { secrEnergyFromCalculations } from "../secr-energy";
import type { CalculationRow } from "../aggregation";

function calc(code: string, scope: number, amount: number, unit: string, fuelType: string | null = null, scope2Method: string | null = null) {
  return {
    normalizedAmount: amount,
    normalizedUnit: unit,
    activityRecord: { fuelType, scope2Method, emissionCategory: { code, scope, name: code } },
  } as unknown as CalculationRow;
}

describe("secrEnergyFromCalculations", () => {
  it("adds kWh as recorded and converts fuel litres at DESNZ gross CV", () => {
    const e = secrEnergyFromCalculations([
      calc("s1-stationary", 1, 424_000, "kWh", "natural gas"),
      calc("s1-stationary", 1, 1_000, "litre", "gas oil"),
      calc("s1-mobile", 1, 1_000, "litre", "diesel"),
      calc("s1-mobile", 1, 1_000, "litre", "petrol"),
      calc("s2-electricity-lb", 2, 50_000, "kWh"),
    ]);
    expect(e.gasKwh).toBeCloseTo(424_000 + 10_742.3, 1);
    expect(e.transportFuelKwh).toBeCloseTo(10_531.4 + 9_424.1, 1);
    expect(e.electricityKwh).toBe(50_000);
    expect(e.totalKwh).toBeCloseTo(e.gasKwh + e.transportFuelKwh + e.electricityKwh, 6);
    expect(e.unconverted).toBe(0);
  });

  it("counts electricity once when both Scope 2 methods are recorded", () => {
    const e = secrEnergyFromCalculations([
      calc("s2-electricity-lb", 2, 10_000, "kWh"),
      calc("s2-electricity-mb", 2, 10_000, "kWh"),
    ]);
    expect(e.electricityKwh).toBe(10_000);
  });

  it("uses market-based kWh when that is all there is", () => {
    const e = secrEnergyFromCalculations([calc("s2-electricity-mb", 2, 8_000, "kWh")]);
    expect(e.electricityKwh).toBe(8_000);
  });

  it("leaves out and counts quantities with no kWh equivalent", () => {
    const e = secrEnergyFromCalculations([
      calc("s1-mobile", 1, 500, "litre", "HVO100"),
      calc("s1-stationary", 1, 2, "tonne", "coal"),
      calc("s1-mobile", 1, 100, "litre", null),
      calc("s3-business-travel", 3, 1_000, "km"),
    ]);
    expect(e.totalKwh).toBe(0);
    expect(e.unconverted).toBe(3);
  });
});
