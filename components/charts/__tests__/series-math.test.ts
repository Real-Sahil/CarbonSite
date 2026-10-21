import { describe, expect, it } from "vitest";
import { cumulative, rangeStart, sma } from "../series-math";

const pts = [1, 2, 3, 4].map((value, i) => ({ time: `2026-01-0${i + 1}`, value }));

describe("series-math", () => {
  it("averages over a window, using what exists at the start", () => {
    expect(sma(pts, 2).map((p) => p.value)).toEqual([1, 1.5, 2.5, 3.5]);
  });
  it("sums running totals", () => {
    expect(cumulative(pts).map((p) => p.value)).toEqual([1, 3, 6, 10]);
  });
  it("counts ranges back from the last point", () => {
    expect(rangeStart("2026-05-31", "3M")).toBe("2026-02-28");
    expect(rangeStart("2026-05-31", "YTD")).toBe("2026-01-01");
    expect(rangeStart("2026-05-31", "All")).toBeNull();
  });
});
