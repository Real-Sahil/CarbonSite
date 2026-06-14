import { describe, expect, test } from "vitest";
import { UnitError } from "../units";
import { computeRecordEmission } from "../record";

describe("computeRecordEmission", () => {
  test("normalizes activity units before applying the emission factor", () => {
    const calculation = computeRecordEmission(
      2.5,
      "tonne",
      { co2e: 0.12 },
      "kg",
    );

    expect(calculation.originalAmount).toBe(2.5);
    expect(calculation.originalUnit).toBe("tonne");
    expect(calculation.normalizedAmount).toBe(2500);
    expect(calculation.normalizedUnit).toBe("kg");
    expect(calculation.result.totalCo2e).toBeCloseTo(300);
    expect(calculation.result.warnings).toHaveLength(0);
  });

  test("rejects unsupported activity units", () => {
    expect(() =>
      computeRecordEmission(1, "skip", { co2e: 1 }, "kg"),
    ).toThrow(UnitError);
  });
});
