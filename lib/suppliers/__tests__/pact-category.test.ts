import { describe, expect, it } from "vitest";
import { mapPactCategoryToInternal } from "../pact-category";

const SEEDED_SCOPE3_CODES = [
  "s3-purchased-goods",
  "s3-capital-goods",
  "s3-fuel-energy",
  "s3-upstream-transport",
  "s3-waste",
  "s3-business-travel",
  "s3-commuting",
  "s3-upstream-leased",
  "s3-downstream-transport",
  "s3-processing-sold",
  "s3-use-sold",
  "s3-end-of-life",
  "s3-downstream-leased",
  "s3-franchises",
  "s3-investments",
];

describe("mapPactCategoryToInternal", () => {
  it("maps every PACT Scope 3 category to its own seeded code", () => {
    expect(mapPactCategoryToInternal("processing-sold-products")).toBe("s3-processing-sold");
    expect(mapPactCategoryToInternal("use-sold-products")).toBe("s3-use-sold");
    expect(mapPactCategoryToInternal("end-of-life-sold-products")).toBe("s3-end-of-life");
    expect(mapPactCategoryToInternal("purchased-goods-services")).toBe("s3-purchased-goods");
    expect(mapPactCategoryToInternal("waste-generated-operations")).toBe("s3-waste");
  });

  it("only returns codes that are seeded", () => {
    const names = [
      "purchased-goods-services",
      "capital-goods",
      "fuel-energy-not-included-in-scope",
      "upstream-transportation-distribution",
      "waste-generated-operations",
      "business-travel",
      "employee-commuting",
      "upstream-leased-assets",
      "downstream-transportation-distribution",
      "processing-sold-products",
      "use-sold-products",
      "end-of-life-sold-products",
      "downstream-leased-assets",
      "franchises",
      "investments",
    ];
    for (const name of names) {
      expect(SEEDED_SCOPE3_CODES).toContain(mapPactCategoryToInternal(name));
    }
  });

  it("returns null for an unknown name so the caller decides", () => {
    expect(mapPactCategoryToInternal("processing-sold")).toBeNull();
    expect(mapPactCategoryToInternal("")).toBeNull();
  });

  it("does not resolve inherited object keys", () => {
    expect(mapPactCategoryToInternal("constructor")).toBeNull();
    expect(mapPactCategoryToInternal("__proto__")).toBeNull();
  });
});
