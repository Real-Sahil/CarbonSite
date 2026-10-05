// @vitest-environment node
import { describe, expect, it } from "vitest";
import { conformalQuantile, holdoutSize, selectForecast, type SelectedForecast } from "../select";

const month = (i: number) => new Date(Date.UTC(2023, i, 1)).toISOString().split("T")[0];
const series = (vals: number[]) => vals.map((value, i) => ({ date: month(i), value }));

// 36 months: level 100, a clear yearly pattern, tiny noise.
const SEASON = [0, -8, -12, -6, 4, 10, 16, 12, 6, -2, -10, -14];
const seasonal = series(Array.from({ length: 36 }, (_, i) => 100 + SEASON[i % 12] + ((i * 7) % 3) * 0.2));
const trending = series(Array.from({ length: 18 }, (_, i) => 50 + 3 * i));

describe("selectForecast", () => {
  it("picks a seasonal model on a seasonal series and says why", () => {
    const f = selectForecast(seasonal, 12);
    expect(["seasonal_naive", "seasonal_theta"]).toContain(f.method);
    const sel = f.metadata.selection as { winner: string; candidates: Array<{ method: string; mape: number }> };
    expect(sel.winner).toBe(f.method);
    expect(sel.candidates.map((c) => c.method)).toEqual(expect.arrayContaining(["naive", "theta", "seasonal_naive"]));
    // Forecast keeps the shape: July is higher than February.
    expect(f.predictions[(6 - 0 + 12 - 0) % 12].forecast).toBeGreaterThan(f.predictions[(1 + 12) % 12].forecast);
  });

  it("follows a trend on a short series", () => {
    const f = selectForecast(trending, 6);
    expect(f.method).not.toBe("naive");
    expect(f.predictions[5].forecast).toBeGreaterThan(f.predictions[0].forecast);
  });

  it("uses first-of-month dates and non-negative, ordered ranges", () => {
    const f = selectForecast(seasonal, 4);
    expect(f.predictions.map((p) => p.date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]);
    for (const p of f.predictions) {
      expect(p.lowerBound).toBeGreaterThanOrEqual(0);
      expect(p.lowerBound).toBeLessThanOrEqual(p.forecast);
      expect(p.upperBound).toBeGreaterThanOrEqual(p.forecast);
    }
    expect(f.metadata.intervalMethod).toBe("conformal");
  });

  it("widens the range with the horizon", () => {
    const noisy = series(Array.from({ length: 24 }, (_, i) => 100 + ((i * 37) % 17) - 8));
    const f = selectForecast(noisy, 8);
    const w = (k: number) => f.predictions[k].upperBound - f.predictions[k].lowerBound;
    expect(w(7)).toBeGreaterThanOrEqual(w(0));
  });

  it("lets Prophet win only with a holdout score that beats the local models", () => {
    const prophet = (accuracy: number, accuracyConfidence: string): SelectedForecast => ({
      predictions: [{ date: "2026-01-01", forecast: 1, lowerBound: 0, upperBound: 2, confidence: 0.95 }],
      accuracy,
      method: "prophet",
      metadata: { accuracyConfidence },
      trainingDataPoints: 36,
    });
    expect(selectForecast(seasonal, 1, prophet(100, "holdout")).method).toBe("prophet");
    expect(selectForecast(seasonal, 1, prophet(10, "holdout")).method).not.toBe("prophet");
    // An in-sample score is not comparable, so it never wins.
    expect(selectForecast(seasonal, 1, prophet(100, "low")).method).not.toBe("prophet");
  });

  it("falls back to the old engine below the comparison minimum", () => {
    const f = selectForecast(series([10, 12, 11, 13, 12]), 3);
    expect((f.metadata.selection as { reason: string }).reason).toMatch(/too few/);
    expect(f.predictions).toHaveLength(3);
  });

  it("handles a flat zero series without NaN", () => {
    const f = selectForecast(series(Array(14).fill(0)), 3);
    for (const p of f.predictions) expect(Number.isFinite(p.forecast) && Number.isFinite(p.upperBound)).toBe(true);
  });
});

describe("helpers", () => {
  it("conformal quantile is the largest error when there are too few samples", () => {
    expect(conformalQuantile([1, 5, 3])).toBe(5);
    expect(conformalQuantile(Array.from({ length: 99 }, (_, i) => i + 1), 0.9)).toBe(90);
    expect(conformalQuantile([])).toBe(0);
  });
  it("holds out one to three months", () => {
    expect([holdoutSize(8), holdoutSize(12), holdoutSize(36)]).toEqual([1, 2, 3]);
  });
});
