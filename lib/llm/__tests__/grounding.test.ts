import { describe, expect, it } from "vitest";
import { ungroundedNumbers } from "../grounding";

const facts = "Total 1,234.57 tCO2e. Scope 1: 400.12 tCO2e (32.4%). Records 1520. Period FY2025.";

describe("ungroundedNumbers", () => {
  it("accepts figures from the facts at any rounding", () => {
    expect(ungroundedNumbers("Emissions were 1,234.6 tCO2e, about 1,235 tCO2e, with Scope 1 at 32% of the total.", facts)).toEqual([]);
  });

  it("flags a figure the facts do not contain", () => {
    expect(ungroundedNumbers("Emissions fell 12% to 1,100 tCO2e.", facts)).toEqual(["12", "1,100"]);
  });

  it("ignores labels and small counts but not small percentages", () => {
    expect(ungroundedNumbers("1. Scope 3 Category 1 and s3-waste dominate across 3 sites.", facts)).toEqual([]);
    expect(ungroundedNumbers("A 5% cut is achievable.", facts)).toEqual(["5"]);
  });

  it("requires years to come from the facts", () => {
    expect(ungroundedNumbers("In FY2025 the group", facts)).toEqual([]);
    expect(ungroundedNumbers("By 2030 the group", facts)).toEqual(["2030"]);
  });
});
