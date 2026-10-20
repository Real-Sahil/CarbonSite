import { describe, expect, it } from "vitest";
import { priorComparablePeriod } from "../prior-period";

const p = (id: string, s: string, e: string) => ({ id, startDate: new Date(s), endDate: new Date(e) });
const y2026ytd = p("26", "2026-01-01", "2026-09-30");
const y2025 = p("25", "2025-01-01", "2025-12-31");
const y2024 = p("24", "2024-01-01", "2024-12-31");
const y2025ytd = p("25ytd", "2025-01-01", "2025-09-30");

describe("priorComparablePeriod", () => {
  it("skips a full year when the current period is a part year", () => {
    expect(priorComparablePeriod([y2026ytd, y2025, y2024], y2026ytd)).toBeNull();
  });
  it("takes the next period of the same length", () => {
    expect(priorComparablePeriod([y2025, y2024], y2025)?.id).toBe("24");
  });
  it("finds a comparable period further back", () => {
    expect(priorComparablePeriod([y2026ytd, y2025, y2025ytd], y2026ytd)?.id).toBe("25ytd");
  });
  it("returns null with no current period", () => {
    expect(priorComparablePeriod([y2025], null)).toBeNull();
  });
});
