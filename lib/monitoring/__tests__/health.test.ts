import { describe, expect, it } from "vitest";
import { HEALTH_CHECK_EVERY_MS, slowPages, staleJobs, type Heartbeat } from "@/lib/monitoring/health";

const H = 3_600_000;
const now = new Date("2026-10-29T12:00:00Z");
const ago = (hours: number) => new Date(now.getTime() - hours * H);
const expected = { daily: 36 * H, weekly: 8 * 24 * H };
const beat = (job: string, run: number, success: number | null, lastError: string | null = null): Heartbeat => ({
  job,
  lastRunAt: ago(run),
  lastSuccessAt: success === null ? null : ago(success),
  lastError,
});
const longWatched = 100 * 24 * H;

describe("staleJobs", () => {
  it("is quiet when jobs succeeded within their interval", () => {
    expect(staleJobs([beat("daily", 5, 5), beat("weekly", 100, 100)], now, longWatched, expected)).toEqual([]);
  });

  it("reports a job whose last success is older than its interval", () => {
    const [s] = staleJobs([beat("daily", 40, 40), beat("weekly", 1, 1)], now, longWatched, expected);
    expect(s).toMatchObject({ job: "daily", reason: "no_success_within_interval", hoursSinceSuccess: 40, stillCalled: false });
  });

  it("tells a job that is called but failing from one that is not called", () => {
    const [s] = staleJobs([beat("daily", 2, 50, "boom"), beat("weekly", 1, 1)], now, longWatched, expected);
    expect(s).toMatchObject({ job: "daily", stillCalled: true, lastError: "boom" });
  });

  it("does not alert for a job that never reported until monitor-health has watched past its interval", () => {
    expect(staleJobs([beat("weekly", 1, 1)], now, 6 * H, expected)).toEqual([]);
    const out = staleJobs([beat("weekly", 1, 1)], now, 36 * H + HEALTH_CHECK_EVERY_MS, expected);
    expect(out).toEqual([expect.objectContaining({ job: "daily", reason: "never_reported" })]);
  });

  it("does not alert on a first failed call", () => {
    expect(staleJobs([beat("daily", 1, null, "x"), beat("weekly", 1, 1)], now, 2 * H, expected)).toEqual([]);
    const out = staleJobs([beat("daily", 1, null, "x"), beat("weekly", 1, 1)], now, 40 * H, expected);
    expect(out[0]).toMatchObject({ job: "daily", reason: "never_succeeded", stillCalled: true });
  });
});

describe("slowPages", () => {
  const row = (page: string, loads: number, slow: number, verySlow = 0) => ({ page, loads, slow, verySlow });

  it("flags a page where more than 5% of loads took 3 s or more", () => {
    const [p] = slowPages([row("dashboard", 200, 11, 2)]);
    expect(p).toMatchObject({ page: "dashboard", loads: 200, slow: 11, slowShare: 0.055 });
  });

  it("passes exactly 5% and below", () => {
    expect(slowPages([row("dashboard", 200, 10)])).toEqual([]);
  });

  it("ignores a sample too small to mean anything", () => {
    expect(slowPages([row("dashboard", 10, 10)])).toEqual([]);
  });

  it("adds the days together before judging", () => {
    expect(slowPages([row("dashboard", 30, 3), row("dashboard", 30, 3)])).toEqual([expect.objectContaining({ loads: 60, slow: 6 })]);
  });
});
