import { describe, expect, it } from "vitest";
import { growthMetrics, weekStart, type GrowthOrg } from "../growth";

const org = (created: string, over: Partial<GrowthOrg> = {}): GrowthOrg => ({
  createdAt: new Date(created),
  acquisitionSource: null,
  plan: "trial",
  isPilot: false,
  activationReports: 0,
  ...over,
});

describe("growth metrics", () => {
  it("starts weeks on Monday UTC", () => {
    expect(weekStart(new Date("2026-09-25T12:00:00Z")).toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(weekStart(new Date("2026-09-21T00:00:00Z")).toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });

  it("counts trials, activation and paying by week and source", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    const m = growthMetrics(
      [
        org("2026-09-22T09:00:00Z", { acquisitionSource: "verify", activationReports: 1 }),
        org("2026-09-15T09:00:00Z", { acquisitionSource: "verify", plan: "growth", activationReports: 2 }),
        org("2026-09-16T09:00:00Z", { plan: "starter", isPilot: true }),
        org("2025-01-01T00:00:00Z", { acquisitionSource: "linkedin.com" }),
      ],
      now,
      4,
    );
    expect(m.total).toEqual({ trials: 4, activated: 2, paying: 1 });
    expect(m.byWeek.map((w) => [w.weekStart.toISOString().slice(0, 10), w.trials, w.activated, w.paying])).toEqual([
      ["2026-08-31", 0, 0, 0],
      ["2026-09-07", 0, 0, 0],
      ["2026-09-14", 2, 1, 1],
      ["2026-09-21", 1, 1, 0],
    ]);
    expect(m.bySource).toEqual([
      { source: "verify", trials: 2, activated: 2, paying: 1 },
      { source: "linkedin.com", trials: 1, activated: 0, paying: 0 },
      { source: "unknown", trials: 1, activated: 0, paying: 0 },
    ]);
    expect(m.pilots).toBe(1);
  });
});
