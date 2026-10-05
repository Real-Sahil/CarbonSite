import { describe, expect, it } from "vitest";
import { monthlySeriesFromSlices, MIN_DATED_MONTHS } from "../monthly";

const d = (s: string) => new Date(`${s}-01T00:00:00Z`);

describe("monthlySeriesFromSlices", () => {
  it("sums slices that share a month", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ month: new Date(Date.UTC(2024, i, 1)), totalCo2e: 10 }));
    rows.push({ month: rows[0].month, totalCo2e: 5 });
    const s = monthlySeriesFromSlices(rows)!;
    expect(s).toHaveLength(12);
    expect(s[0]).toEqual({ date: "2024-01-01", value: 15 });
  });
  it("fills a missing month inside the range with zero", () => {
    const rows = ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12", "2025-01"].map((m) => ({ month: d(m), totalCo2e: 1 }));
    const s = monthlySeriesFromSlices(rows)!;
    expect(s).toHaveLength(13);
    expect(s.find((p) => p.date === "2024-06-01")?.value).toBe(0);
  });
  it("returns null when records cover too few months (quarterly bills, undated)", () => {
    const quarterly = ["2024-03", "2024-06", "2024-09", "2024-12"].map((m) => ({ month: d(m), totalCo2e: 100 }));
    expect(monthlySeriesFromSlices(quarterly)).toBeNull();
    expect(monthlySeriesFromSlices([{ month: null, totalCo2e: 5 }])).toBeNull();
    expect(MIN_DATED_MONTHS).toBe(12);
  });
});
