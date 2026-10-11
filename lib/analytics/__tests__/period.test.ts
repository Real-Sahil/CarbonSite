import { describe, expect, it } from "vitest";
import { parseTrendDays, trendWindowStart } from "../period";

const period = { startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") };

describe("trendWindowStart", () => {
  it("covers the whole period when no day count is given", () => {
    expect(trendWindowStart(period, null)).toEqual(period.startDate);
  });

  it("anchors the window at the period end, not today", () => {
    expect(trendWindowStart(period, 30).toISOString().slice(0, 10)).toBe("2025-12-01");
  });

  it("never starts before the period", () => {
    expect(trendWindowStart(period, 366)).toEqual(period.startDate);
  });
});

describe("parseTrendDays", () => {
  it("returns null when absent or not a number", () => {
    expect(parseTrendDays(null)).toBeNull();
    expect(parseTrendDays("abc")).toBeNull();
  });

  it("clamps to 1..366", () => {
    expect(parseTrendDays("0")).toBe(1);
    expect(parseTrendDays("9999")).toBe(366);
    expect(parseTrendDays("30")).toBe(30);
  });
});
