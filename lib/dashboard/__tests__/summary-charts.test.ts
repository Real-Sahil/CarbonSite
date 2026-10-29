import { describe, expect, it } from "vitest";
import { shapeSummaryCharts } from "../summary-charts";

const cat = (name: string, scope: number, kg: number) => ({ kind: "cat" as const, name, scope, startDate: null, kg: String(kg) });
const trend = (label: string, start: string, scope: number, kg: number) => ({ kind: "trend" as const, name: label, scope, startDate: new Date(start), kg: String(kg) });

describe("shapeSummaryCharts", () => {
  it("sorts categories largest first and drops zero rows", () => {
    const out = shapeSummaryCharts([cat("Diesel", 1, 300), cat("Gas", 1, 700), cat("Zero", 3, 0)], 1000);
    expect(out.categories.map((c) => c.name)).toEqual(["Gas", "Diesel"]);
  });

  it("adds one 'Other categories' bar so the bars reach the total", () => {
    const out = shapeSummaryCharts([cat("Gas", 1, 600), cat("Diesel", 1, 200)], 1000);
    const last = out.categories[out.categories.length - 1];
    expect(last).toEqual({ name: "Other categories", scope: 0, value: 200 });
    expect(out.categories.reduce((s, c) => s + c.value, 0)).toBe(1000);
  });

  it("leaves out a remainder under half a percent and an empty list", () => {
    expect(shapeSummaryCharts([cat("Gas", 1, 999)], 1000).categories).toHaveLength(1);
    expect(shapeSummaryCharts([], 1000).categories).toEqual([]);
  });

  it("builds the trend per period in start-date order, summing scopes", () => {
    const out = shapeSummaryCharts(
      [trend("FY2025", "2025-01-01", 1, 10), trend("FY2024", "2024-01-01", 2, 5), trend("FY2025", "2025-01-01", 3, 40), trend("FY2024", "2024-01-01", 1, 1)],
      0,
    );
    expect(out.trend).toEqual([
      { label: "FY2024", scope1: 1, scope2: 5, scope3: 0 },
      { label: "FY2025", scope1: 10, scope2: 0, scope3: 40 },
    ]);
  });
});
