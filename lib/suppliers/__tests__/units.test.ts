import { describe, expect, it } from "vitest";
import { isSupplierCurrency, isSupplierUnit, methodForUnit } from "../units";

describe("supplier report units", () => {
  it("derives the method from the unit", () => {
    expect(methodForUnit("tCO2e")).toBe("direct_measurement");
    expect(methodForUnit("kgCO2e")).toBe("direct_measurement");
    expect(methodForUnit("kWh")).toBe("activity_based");
    expect(methodForUnit("tonne")).toBe("activity_based");
    expect(methodForUnit("GBP")).toBe("spend_based");
    expect(methodForUnit("AUD")).toBe("spend_based");
  });
  it("takes any currency code but not look-alike units", () => {
    expect(isSupplierCurrency("EUR")).toBe(true);
    expect(isSupplierCurrency("kWh")).toBe(false);
    expect(isSupplierCurrency("kg")).toBe(false);
    expect(isSupplierCurrency("gbp")).toBe(false);
  });
  it("refuses units it does not know", () => {
    expect(isSupplierUnit("furlong")).toBe(false);
    expect(isSupplierUnit("m3")).toBe(true);
  });
});
