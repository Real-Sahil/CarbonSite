import { describe, it, expect } from "vitest";
import { normalizeUnit, areUnitsCompatible, convertBetween, UnitError } from "../units";

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

  it("matches the mobile app's plural forms across dimensions", () => {
    expect(areUnitsCompatible("tonnes", "kg")).toBe(true);
    expect(areUnitsCompatible("litres", "us gallon")).toBe(true);
    expect(areUnitsCompatible("kg", "litre")).toBe(false);
  });
});

describe("normalizeUnit — mobile capture vocabulary", () => {
  it("normalizes the exact strings the Flutter form and OCR emit", () => {
    expect(normalizeUnit(2.5, "tonnes")).toEqual({ amount: 2500, unit: "kg" });
    expect(normalizeUnit(42.5, "litres")).toEqual({ amount: 42.5, unit: "litre" });
    expect(normalizeUnit(10, "gallons").amount).toBeCloseTo(45.4609);
    expect(normalizeUnit(1250, "units")).toEqual({ amount: 1250, unit: "unit" });
  });
});

describe("convertBetween", () => {
  it("converts within a dimension (kg record vs per-tonne factor)", () => {
    expect(convertBetween(2500, "kg", "tonne")).toBeCloseTo(2.5);
    expect(convertBetween(2.5, "tonne", "kg")).toBeCloseTo(2500);
    expect(convertBetween(1, "mwh", "kWh")).toBeCloseTo(1000);
    expect(convertBetween(10, "gallon", "litre")).toBeCloseTo(45.4609);
  });

  it("is identity for the same unit", () => {
    expect(convertBetween(7, "kg", "kg")).toBe(7);
  });

  it("returns null across dimensions — callers must not multiply through", () => {
    expect(convertBetween(100, "kg", "litre")).toBeNull();
    expect(convertBetween(100, "kg", "GBP")).toBeNull();
    expect(convertBetween(100, "unit", "kg")).toBeNull();
  });

  it("returns null for unknown units", () => {
    expect(convertBetween(1, "bananas", "kg")).toBeNull();
  });
});
