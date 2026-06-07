import { describe, it, expect } from "vitest";
import { normalizeUnit, areUnitsCompatible, UnitError } from "../units";

describe("normalizeUnit", () => {
  it("returns same value for canonical units", () => {
    expect(normalizeUnit(10, "kWh")).toEqual({ amount: 10, unit: "kWh" });
    expect(normalizeUnit(5, "kg")).toEqual({ amount: 5, unit: "kg" });
    expect(normalizeUnit(20, "litre")).toEqual({ amount: 20, unit: "litre" });
  });

  it("converts MWh to kWh", () => {
    const result = normalizeUnit(1, "MWh");
    expect(result.amount).toBeCloseTo(1000);
    expect(result.unit).toBe("kWh");
  });

  it("converts tonne to kg", () => {
    const result = normalizeUnit(2.5, "tonne");
    expect(result.amount).toBeCloseTo(2500);
    expect(result.unit).toBe("kg");
  });

  it("converts miles to km", () => {
    const result = normalizeUnit(100, "miles");
    expect(result.amount).toBeCloseTo(160.934);
    expect(result.unit).toBe("km");
  });

  it("converts UK gallon to litre", () => {
    const result = normalizeUnit(1, "gallon");
    expect(result.amount).toBeCloseTo(4.54609);
    expect(result.unit).toBe("litre");
  });

  it("converts GJ to kWh", () => {
    const result = normalizeUnit(1, "GJ");
    expect(result.amount).toBeCloseTo(277.778);
    expect(result.unit).toBe("kWh");
  });

  it("is case-insensitive", () => {
    expect(normalizeUnit(1, "KWH")).toEqual({ amount: 1, unit: "kWh" });
    expect(normalizeUnit(1, "KG")).toEqual({ amount: 1, unit: "kg" });
  });

  it("throws UnitError for unknown units", () => {
    expect(() => normalizeUnit(1, "furlong")).toThrow(UnitError);
    expect(() => normalizeUnit(1, "")).toThrow(UnitError);
  });
});

describe("areUnitsCompatible", () => {
  it("returns true for same-dimension units", () => {
    expect(areUnitsCompatible("kWh", "MWh")).toBe(true);
    expect(areUnitsCompatible("kg", "tonne")).toBe(true);
    expect(areUnitsCompatible("litre", "gallon")).toBe(true);
    expect(areUnitsCompatible("km", "mile")).toBe(true);
  });

  it("returns false for different-dimension units", () => {
    expect(areUnitsCompatible("kWh", "kg")).toBe(false);
    expect(areUnitsCompatible("litre", "km")).toBe(false);
  });

  it("returns false for unknown units", () => {
    expect(areUnitsCompatible("kWh", "furlong")).toBe(false);
  });
});
