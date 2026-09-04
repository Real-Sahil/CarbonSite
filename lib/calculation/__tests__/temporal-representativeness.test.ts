import { describe, it, expect } from "vitest";
import { assessTemporalRepresentativeness } from "../temporal-representativeness";

describe("assessTemporalRepresentativeness", () => {
  it("returns no warning when the factor has no effective date", () => {
    const result = assessTemporalRepresentativeness({
      factorEffectiveStartDate: null,
      factorEffectiveEndDate: null,
      activityDate: new Date("2026-06-01"),
    });
    expect(result.warning).toBeNull();
    expect(result.isStale).toBe(false);
    expect(result.yearsGap).toBeNull();
  });

  it("returns no warning when the factor vintage is recent", () => {
    const result = assessTemporalRepresentativeness({
      factorEffectiveStartDate: new Date("2025-01-01"),
      factorEffectiveEndDate: null,
      activityDate: new Date("2026-06-01"),
    });
    expect(result.isStale).toBe(false);
    expect(result.warning).toBeNull();
  });

  it("flags a factor more than 3 years stale relative to the activity date", () => {
    const result = assessTemporalRepresentativeness({
      factorEffectiveStartDate: new Date("2018-01-01"),
      factorEffectiveEndDate: null,
      activityDate: new Date("2026-06-01"),
    });
    expect(result.isStale).toBe(true);
    expect(result.warning).toContain("years from the activity date");
    expect(result.yearsGap).toBeGreaterThan(3);
  });

  it("prefers the factor's effective end date over its start date when both are set", () => {
    const result = assessTemporalRepresentativeness({
      factorEffectiveStartDate: new Date("2015-01-01"),
      factorEffectiveEndDate: new Date("2026-01-01"),
      activityDate: new Date("2026-06-01"),
    });
    expect(result.isStale).toBe(false);
  });
});
