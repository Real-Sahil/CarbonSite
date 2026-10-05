/**
 * Picks the forecasting model per series by how it did on the same out-of-sample
 * window, and puts distribution-free (conformal) ranges around the pick.
 *
 * Why: the monthly series here are short (12 to 36 points). A seasonal model such as
 * Prophet needs about two years to identify yearly seasonality; below that a plain
 * smoothing or Theta forecast is often better. So every candidate forecasts the last few
 * months from the earlier ones, and the lowest error wins. Prophet (from the Python
 * function) is a candidate only when it was asked for and reported a real holdout score.
 * Pure TypeScript, no dependencies.
 *
 * The comparison uses the same split and the same error as api/forecast.py: forecast the
 * last `holdout` months from the earlier ones, mean absolute percentage error.
 */

import { autoForecast } from "./engine";

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface SelectedForecast {
  predictions: Array<{ date: string; forecast: number; lowerBound: number; upperBound: number; confidence: number }>;
  accuracy: number;
  method: string;
  metadata: Record<string, unknown>;
  trainingDataPoints: number;
}

type Model = (train: number[], h: number) => number[];

/** Fewer points than this cannot be compared fairly; the old engine answers. */
export const MIN_POINTS_TO_COMPARE = 8;

export function holdoutSize(n: number): number {
  return Math.min(3, Math.max(1, Math.floor(n / 6)));
}

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

function mape(actual: number[], predicted: number[]): number {
  return mean(actual.map((y, i) => Math.abs((y - predicted[i]) / Math.max(Math.abs(y), 1e-6)))) * 100;
}

const naive: Model = (y, h) => Array(h).fill(y[y.length - 1]);

const seasonalNaive: Model = (y, h) =>
  y.length < 12 ? naive(y, h) : Array.from({ length: h }, (_, k) => y[y.length - 12 + (k % 12)]);

/** Simple exponential smoothing with alpha picked by one-step error on the training data. */
function fitSes(y: number[]): { level: number; alpha: number } {
  let best = { level: y[0], alpha: 0.3, sse: Infinity };
  for (let a = 0.1; a <= 0.91; a += 0.1) {
    let level = y[0];
    let sse = 0;
    for (let i = 1; i < y.length; i++) {
      sse += (y[i] - level) ** 2;
      level = a * y[i] + (1 - a) * level;
    }
    if (sse < best.sse) best = { level, alpha: a, sse };
  }
  return { level: best.level, alpha: best.alpha };
}

const ses: Model = (y, h) => Array(h).fill(fitSes(y).level);

/** Standard Theta (Hyndman and Billah): SES plus half the linear trend slope. */
const theta: Model = (y, h) => {
  const n = y.length;
  const { level, alpha } = fitSes(y);
  const tBar = (n - 1) / 2;
  const yBar = mean(y);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - tBar) * (y[i] - yBar);
    sxx += (i - tBar) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return Array.from({ length: h }, (_, k) => level + 0.5 * slope * (k + 1 / alpha - (1 - alpha) ** n / alpha));
};

/** Theta on the series with its yearly pattern taken out, the pattern added back. Needs two years. */
const seasonalTheta: Model = (y, h) => {
  const n = y.length;
  if (n < 24) return theta(y, h);
  const tBar = (n - 1) / 2;
  const yBar = mean(y);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - tBar) * (y[i] - yBar);
    sxx += (i - tBar) ** 2;
  }
  const slope = sxy / sxx;
  const resid = y.map((v, i) => v - (yBar + slope * (i - tBar)));
  const idx = Array.from({ length: 12 }, (_, j) => mean(resid.filter((_, i) => i % 12 === j)));
  const centre = mean(idx);
  const seasonal = idx.map((s) => s - centre);
  const adjusted = y.map((v, i) => v - seasonal[i % 12]);
  return theta(adjusted, h).map((v, k) => v + seasonal[(n + k) % 12]);
};

/** Simplest first: a tie goes to the earlier one. */
const LOCAL: Array<{ name: string; model: Model; minPoints: number }> = [
  { name: "naive", model: naive, minPoints: 1 },
  { name: "exponential_smoothing", model: ses, minPoints: 3 },
  { name: "theta", model: theta, minPoints: 6 },
  { name: "seasonal_naive", model: seasonalNaive, minPoints: 13 },
  { name: "seasonal_theta", model: seasonalTheta, minPoints: 24 },
];

/** The ceil((m+1)q)-th smallest error, or the largest when there are too few for the level. */
export function conformalQuantile(errors: number[], level = 0.95): number {
  if (errors.length === 0) return 0;
  const sorted = [...errors].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((sorted.length + 1) * level) - 1)];
}

/** Absolute errors of an expanding-window forecast, by horizon (1-based index 0 is horizon 1). */
function rollingErrors(model: Model, y: number[], maxH: number): number[][] {
  const byH: number[][] = Array.from({ length: maxH }, () => []);
  const first = Math.max(6, Math.floor(y.length / 2));
  for (let t = first; t < y.length; t++) {
    const f = model(y.slice(0, t), Math.min(maxH, y.length - t));
    for (let k = 0; k < f.length; k++) byH[k].push(Math.abs(y[t + k] - f[k]));
  }
  return byH;
}

function addMonthsUtc(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().split("T")[0];
}

export function selectForecast(data: SeriesPoint[], periods: number, prophet?: SelectedForecast | null): SelectedForecast {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const y = sorted.map((p) => p.value);
  const n = y.length;

  if (n < MIN_POINTS_TO_COMPARE) {
    const f = autoForecast(sorted, periods);
    return { ...f, metadata: { ...f.metadata, selection: { winner: f.method, reason: "too few points to compare models" } } };
  }

  const hh = holdoutSize(n);
  const train = y.slice(0, n - hh);
  const test = y.slice(n - hh);
  const candidates = LOCAL.filter((c) => train.length >= c.minPoints).map((c) => ({
    name: c.name,
    model: c.model,
    mape: mape(test, c.model(train, hh)),
  }));

  const baseline = candidates.find((c) => c.name === "seasonal_naive") ?? candidates.find((c) => c.name === "naive")!;
  const bestLocal = candidates.reduce((best, c) => (c.mape < best.mape - 1e-9 ? c : best));

  // Prophet's accuracy is 100 minus the same holdout MAPE, but only when it held data out.
  const prophetMape =
    prophet && prophet.metadata?.accuracyConfidence === "holdout" ? 100 - prophet.accuracy : null;
  const summary = [
    ...candidates.map((c) => ({ method: c.name, mape: round(c.mape) })),
    ...(prophetMape == null ? [] : [{ method: "prophet", mape: round(prophetMape) }]),
  ];
  const selectionBase = { holdoutMonths: hh, candidates: summary, baselineMape: round(baseline.mape) };

  if (prophet && prophetMape != null && prophetMape <= bestLocal.mape) {
    return {
      ...prophet,
      metadata: { ...prophet.metadata, intervalMethod: "prophet", selection: { ...selectionBase, winner: "prophet" } },
    };
  }

  // Ranges from how this model really missed on earlier months, not from its own assumptions.
  const maxH = Math.min(periods, 3);
  const errs = rollingErrors(bestLocal.model, y, maxH);
  // A longer horizon is never more certain than a shorter one, whatever few samples say.
  const q = errs.map((e) => conformalQuantile(e)).map((v, i, all) => Math.max(...all.slice(0, i + 1)));
  const samples = errs[0]?.length ?? 0;
  const point = bestLocal.model(y, periods);
  const lastIso = sorted[n - 1].date;

  const predictions = point.map((v, k) => {
    const h = k + 1;
    const width = h <= maxH ? q[h - 1] : q[maxH - 1] * Math.sqrt(h / maxH);
    const forecast = Math.max(0, v);
    return {
      date: addMonthsUtc(lastIso, h),
      forecast: round(forecast),
      lowerBound: round(Math.max(0, v - width)),
      upperBound: round(v + width),
      confidence: samples >= 19 ? 0.95 : 0.65,
    };
  });

  return {
    predictions,
    accuracy: round(Math.max(0, Math.min(100, 100 - bestLocal.mape))),
    method: bestLocal.name,
    metadata: {
      accuracyConfidence: "holdout",
      intervalMethod: "conformal",
      intervalSamples: samples,
      selection: { ...selectionBase, winner: bestLocal.name },
    },
    trainingDataPoints: n,
  };
}

const round = (v: number) => Math.round(v * 100) / 100;
