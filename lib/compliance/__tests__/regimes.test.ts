import { describe, expect, it } from "vitest";
import { DISCLOSURE_REGIMES, isDisclosureRegime, readinessCounts } from "../regimes";
import { FRAMEWORK_DATAPOINTS } from "../framework-datapoints";

describe("disclosure regimes", () => {
  it("accepts only known regimes", () => {
    expect(isDisclosureRegime("uk_secr")).toBe(true);
    expect(isDisclosureRegime("toString")).toBe(false);
    expect(isDisclosureRegime(null)).toBe(false);
  });

  it("maps every regime to a framework that has seeded datapoints", () => {
    for (const { framework } of Object.values(DISCLOSURE_REGIMES)) {
      expect(FRAMEWORK_DATAPOINTS.some((d) => d.framework === framework)).toBe(true);
    }
  });
});

describe("readinessCounts", () => {
  it("leaves not_applicable out of the denominator", () => {
    const c = readinessCounts(["satisfied", "partial", "gap", "not_applicable"]);
    expect(c).toMatchObject({ applicable: 3, satisfied: 1, partial: 1, gap: 1 });
    expect(c.percent).toBeCloseTo(33.33, 1);
  });

  it("gives no percentage when nothing applies", () => {
    expect(readinessCounts([]).percent).toBeNull();
    expect(readinessCounts(["not_applicable"]).percent).toBeNull();
  });
});
