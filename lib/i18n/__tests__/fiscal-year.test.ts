import { describe, expect, it } from "vitest";
import { fiscalYearOf, isStartMonth } from "../fiscal-year";

describe("fiscalYearOf", () => {
  it("calendar year", () => {
    expect(fiscalYearOf(new Date("2026-10-03T12:00:00Z"), 1)).toEqual({ label: "FY2026", startDate: "2026-01-01", endDate: "2026-12-31" });
  });
  it("April to March, after and before the start", () => {
    expect(fiscalYearOf(new Date("2026-10-03T00:00:00Z"), 4)).toEqual({ label: "FY2026/27", startDate: "2026-04-01", endDate: "2027-03-31" });
    expect(fiscalYearOf(new Date("2026-02-10T00:00:00Z"), 4)).toEqual({ label: "FY2025/26", startDate: "2025-04-01", endDate: "2026-03-31" });
  });
  it("July to June, a leap-year end", () => {
    expect(fiscalYearOf(new Date("2023-09-01T00:00:00Z"), 7).endDate).toBe("2024-06-30");
    expect(fiscalYearOf(new Date("2024-03-01T00:00:00Z"), 3).startDate).toBe("2024-03-01");
    expect(fiscalYearOf(new Date("2024-01-15T00:00:00Z"), 3).endDate).toBe("2024-02-29");
  });
  it("falls back to calendar year on a bad start month", () => {
    expect(fiscalYearOf(new Date("2026-05-01T00:00:00Z"), 13).label).toBe("FY2026");
    expect(isStartMonth(0)).toBe(false);
    expect(isStartMonth(12)).toBe(true);
  });
});
