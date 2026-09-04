import { describe, it, expect } from "vitest";
import {
  triggersRecalculation,
  deltaPercent,
  isSignificant,
  ZERO_TOTALS,
} from "../base-year";

describe("triggersRecalculation", () => {
  it("triggers on every structural change GHG Protocol ch. 5 lists", () => {
    for (const type of [
      "acquisition",
      "divestiture",
      "merger",
      "outsourcing",
      "insourcing",
      "methodology_change",
      "boundary_change",
      "error_correction",
    ] as const) {
      expect(triggersRecalculation(type)).toBe(true);
    }
  });
});

describe("deltaPercent", () => {
  it("reports a signed percentage change", () => {
    expect(deltaPercent(1000, 1100)).toBeCloseTo(10, 10);
    expect(deltaPercent(1000, 900)).toBeCloseTo(-10, 10);
    expect(deltaPercent(1000, 1000)).toBe(0);
  });

  it("uses the magnitude of the baseline so a negative baseline keeps the sign of the move", () => {
    expect(deltaPercent(-100, -50)).toBeCloseTo(50, 10);
  });

  it("treats any move off a zero baseline as a full 100% change", () => {
    // A base year of zero cannot express proportional change, and reporting
    // Infinity would break every threshold comparison downstream.
    expect(deltaPercent(0, 500)).toBe(100);
    expect(deltaPercent(0, 0)).toBe(0);
  });
});

describe("isSignificant", () => {
  it("treats a change exactly at the threshold as significant", () => {
    expect(isSignificant(5, 5)).toBe(true);
  });

  it("compares on magnitude, so a decrease can be significant too", () => {
    expect(isSignificant(-7.5, 5)).toBe(true);
    expect(isSignificant(-2, 5)).toBe(false);
  });

  it("ignores the sign of the configured threshold", () => {
    expect(isSignificant(6, -5)).toBe(true);
  });

  it("treats every change as significant when the threshold is zero", () => {
    expect(isSignificant(0.0001, 0)).toBe(true);
    expect(isSignificant(0, 0)).toBe(true);
  });
});

describe("ZERO_TOTALS", () => {
  it("is a zeroed scope set callers can safely spread", () => {
    expect(ZERO_TOTALS).toEqual({ scope1: 0, scope2: 0, scope3: 0, total: 0 });
    const copy = { ...ZERO_TOTALS };
    copy.scope1 = 5;
    expect(ZERO_TOTALS.scope1).toBe(0);
  });
});
