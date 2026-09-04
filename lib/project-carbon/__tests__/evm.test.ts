import { describe, it, expect } from "vitest";
import { computeCarbonEvm } from "../evm";

describe("computeCarbonEvm", () => {
  it("sums budgetAtCompletion and actual across phases", () => {
    const result = computeCarbonEvm([
      { budgetTco2e: 100, actualTco2e: 40, percentComplete: 50 },
      { budgetTco2e: 200, actualTco2e: 20, percentComplete: 10 },
    ]);
    expect(result.budgetAtCompletionTco2e).toBe(300);
    expect(result.actualTco2e).toBe(60);
  });

  it("computes earned value as budget-weighted percent complete", () => {
    const result = computeCarbonEvm([
      { budgetTco2e: 100, actualTco2e: 0, percentComplete: 50 },
      { budgetTco2e: 200, actualTco2e: 0, percentComplete: 25 },
    ]);
    // 100*0.5 + 200*0.25 = 50 + 50 = 100
    expect(result.earnedValueTco2e).toBe(100);
  });

  it("returns a null CPI when no carbon has been emitted yet", () => {
    const result = computeCarbonEvm([{ budgetTco2e: 100, actualTco2e: 0, percentComplete: 0 }]);
    expect(result.cpi).toBeNull();
  });

  it("reports CPI above 1 when work done cost less carbon than budgeted", () => {
    // Earned 50 tCO2e of budgeted work, only actually emitted 40 — efficient.
    const result = computeCarbonEvm([{ budgetTco2e: 100, actualTco2e: 40, percentComplete: 50 }]);
    expect(result.cpi).toBeCloseTo(50 / 40);
    expect(result.cpi!).toBeGreaterThan(1);
  });

  it("reports CPI below 1 when work done cost more carbon than budgeted", () => {
    const result = computeCarbonEvm([{ budgetTco2e: 100, actualTco2e: 80, percentComplete: 50 }]);
    expect(result.cpi).toBeCloseTo(50 / 80);
    expect(result.cpi!).toBeLessThan(1);
  });

  it("falls back to the linear method when the project is too early for a CPI trend", () => {
    // 2% complete — below the 10% minimum trend threshold even though CPI is defined.
    const result = computeCarbonEvm([{ budgetTco2e: 1000, actualTco2e: 15, percentComplete: 2 }]);
    expect(result.method).toBe("linear_no_trend");
    // AC + (BAC - EV) = 15 + (1000 - 20) = 995
    expect(result.forecastAtCompletionTco2e).toBeCloseTo(995);
  });

  it("uses the CPI trend once enough of the budget is earned", () => {
    const result = computeCarbonEvm([{ budgetTco2e: 1000, actualTco2e: 400, percentComplete: 50 }]);
    expect(result.method).toBe("cpi_trend");
    // CPI = EV/AC = 500/400 = 1.25; EAC = BAC/CPI = 1000/1.25 = 800
    expect(result.forecastAtCompletionTco2e).toBeCloseTo(800);
  });

  it("computes a positive variance at completion when forecast beats budget", () => {
    const result = computeCarbonEvm([{ budgetTco2e: 1000, actualTco2e: 400, percentComplete: 50 }]);
    expect(result.varianceAtCompletionTco2e).toBeCloseTo(1000 - 800);
    expect(result.varianceAtCompletionTco2e).toBeGreaterThan(0);
  });

  it("computes a negative variance at completion when forecast overruns budget", () => {
    // CPI = EV/AC = 500/700 < 1 -> EAC > BAC
    const result = computeCarbonEvm([{ budgetTco2e: 1000, actualTco2e: 700, percentComplete: 50 }]);
    expect(result.varianceAtCompletionTco2e).toBeLessThan(0);
  });

  it("clamps percentComplete inputs to the 0-100 range", () => {
    const result = computeCarbonEvm([{ budgetTco2e: 100, actualTco2e: 10, percentComplete: 150 }]);
    expect(result.earnedValueTco2e).toBe(100);
  });

  it("handles an empty phase list without throwing", () => {
    const result = computeCarbonEvm([]);
    expect(result.budgetAtCompletionTco2e).toBe(0);
    expect(result.cpi).toBeNull();
    expect(result.forecastAtCompletionTco2e).toBe(0);
  });
});
