import { describe, it, expect } from "vitest";
import { computeWholeLifeCarbon, replacementCount } from "../whole-life";

describe("replacementCount", () => {
  it("counts a 20-year cycle over a 60-year study period as 2 replacements", () => {
    // Replacements fall due at year 20 and 40; year 60 ends the study, no reinstall needed.
    expect(replacementCount(60, 20)).toBe(2);
  });

  it("counts a 25-year cycle over a 60-year study period as 2 replacements", () => {
    expect(replacementCount(60, 25)).toBe(2);
  });

  it("excludes a replacement that falls exactly at the end of the study period", () => {
    expect(replacementCount(60, 30)).toBe(1);
  });

  it("returns 0 when the material outlasts the study period", () => {
    expect(replacementCount(60, 100)).toBe(0);
  });

  it("returns 0 for a non-positive cycle", () => {
    expect(replacementCount(60, 0)).toBe(0);
  });
});

describe("computeWholeLifeCarbon", () => {
  it("sums A-stage totals across materials", () => {
    const result = computeWholeLifeCarbon({
      materials: [
        { embodiedTotalKgCo2e: 1000, endOfLifeKgCo2e: 0, moduleDKgCo2e: 0, replacementCycleYears: null },
        { embodiedTotalKgCo2e: 500, endOfLifeKgCo2e: 0, moduleDKgCo2e: 0, replacementCycleYears: null },
      ],
      assessmentPeriodYears: 60,
      operationalEnergyKgCo2e: 0,
    });
    expect(result.aStagesKgCo2e).toBeCloseTo(1500);
  });

  it("computes B4 replacement from each material's replacement cycle", () => {
    const result = computeWholeLifeCarbon({
      materials: [
        // Replaced twice over 60 years (cycle 20yr) -> 2 * 1000 = 2000 kgCO2e
        { embodiedTotalKgCo2e: 1000, endOfLifeKgCo2e: 0, moduleDKgCo2e: 0, replacementCycleYears: 20 },
        // Never replaced (structural, no cycle)
        { embodiedTotalKgCo2e: 5000, endOfLifeKgCo2e: 0, moduleDKgCo2e: 0, replacementCycleYears: null },
      ],
      assessmentPeriodYears: 60,
      operationalEnergyKgCo2e: 0,
    });
    expect(result.b4ReplacementKgCo2e).toBeCloseTo(2000);
  });

  it("passes real operational energy through unchanged as B6", () => {
    const result = computeWholeLifeCarbon({
      materials: [],
      assessmentPeriodYears: 60,
      operationalEnergyKgCo2e: 123456,
    });
    expect(result.b6OperationalEnergyKgCo2e).toBe(123456);
  });

  it("defaults B7 to zero with a warning when no manual water figure is given", () => {
    const result = computeWholeLifeCarbon({
      materials: [],
      assessmentPeriodYears: 60,
      operationalEnergyKgCo2e: 0,
    });
    expect(result.b7OperationalWaterKgCo2e).toBe(0);
    expect(result.warnings.some((w) => w.includes("B7"))).toBe(true);
  });

  it("uses the manually entered B7 figure when provided", () => {
    const result = computeWholeLifeCarbon({
      materials: [],
      assessmentPeriodYears: 60,
      operationalEnergyKgCo2e: 0,
      operationalWaterKgCo2e: 42,
    });
    expect(result.b7OperationalWaterKgCo2e).toBe(42);
  });

  it("always reports B1-B3 as unmodelled via a warning", () => {
    const result = computeWholeLifeCarbon({
      materials: [],
      assessmentPeriodYears: 60,
      operationalEnergyKgCo2e: 0,
    });
    expect(result.warnings.some((w) => w.includes("B1") && w.includes("B2") && w.includes("B3"))).toBe(true);
  });

  it("keeps module D separate from the whole-life total", () => {
    const result = computeWholeLifeCarbon({
      materials: [
        { embodiedTotalKgCo2e: 1000, endOfLifeKgCo2e: 50, moduleDKgCo2e: -200, replacementCycleYears: null },
      ],
      assessmentPeriodYears: 60,
      operationalEnergyKgCo2e: 100,
    });
    expect(result.moduleDMemoKgCo2e).toBe(-200);
    expect(result.wholeLifeTotalKgCo2e).toBeCloseTo(1000 + 50 + 100);
  });

  it("assembles the full whole-life total as A + B4 + B6 + B7 + C", () => {
    const result = computeWholeLifeCarbon({
      materials: [
        { embodiedTotalKgCo2e: 1000, endOfLifeKgCo2e: 50, moduleDKgCo2e: 0, replacementCycleYears: 30 },
      ],
      assessmentPeriodYears: 60,
      operationalEnergyKgCo2e: 500,
      operationalWaterKgCo2e: 25,
    });
    // B4: 1 replacement (30yr cycle, 60yr period) * 1000 = 1000
    expect(result.b4ReplacementKgCo2e).toBeCloseTo(1000);
    expect(result.wholeLifeTotalKgCo2e).toBeCloseTo(1000 + 1000 + 500 + 25 + 50);
  });
});
