// Carbon budget burn-down: measured carbon month by month against a straight
// spend line across the project's dates, and a forecast at completion.
// Forecast method, in order of preference:
//   evm       the phases' earned-value forecast (BAC / CPI) once enough work
//             is reported complete for the trend to mean something;
//   run_rate  carbon to date plus the average of the last three months for
//             each month left to the project's end date;
//   none      no end date or too little data to forecast.
// Pure; the loader lives in ./burndown-load.ts.

import type { EvmResult } from "./evm";

export type MonthPoint = { month: string; tco2e: number };
export type ForecastMethod = "evm" | "run_rate" | "none";
export type BudgetStatus = "over" | "at_risk" | "on_track" | "no_budget";

export type BurndownPoint = {
  month: string;
  actual: number | null;
  cumulativeActual: number | null;
  plannedCumulative: number | null;
  forecastCumulative: number | null;
};

export type Burndown = {
  budgetTco2e: number;
  actualToDate: number;
  plannedToDate: number | null;
  runRatePerMonth: number | null;
  forecastAtCompletion: number | null;
  method: ForecastMethod;
  varianceAtCompletion: number | null;
  status: BudgetStatus;
  reasons: string[];
  points: BurndownPoint[];
};

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

function monthsBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: string[] = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? (y++, (m = 1)) : m++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (out.length > 600) break;
  }
  return out;
}

/** Share of the project's duration elapsed by the end of `month`, 0-1. */
function elapsedShare(month: string, start: Date, end: Date): number {
  const [y, m] = month.split("-").map(Number);
  const monthEnd = Date.UTC(y, m, 1) - 1;
  const span = end.getTime() - start.getTime();
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (monthEnd - start.getTime()) / span));
}

/** An alert when the budget is forecast to be exceeded, or nearly, or is being burnt well ahead of plan. */
export const AT_RISK_SHARE = 0.9;
export const AHEAD_OF_PLAN_SHARE = 1.1;

export function computeBurndown(input: {
  budgetTco2e: number;
  start: Date | null;
  end: Date | null;
  monthly: MonthPoint[];
  asOf: Date;
  evm?: EvmResult | null;
}): Burndown {
  const { budgetTco2e, start, end, asOf } = input;
  const byMonth = new Map<string, number>();
  for (const p of input.monthly) byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.tco2e);

  const now = monthKey(asOf);
  const dataMonths = [...byMonth.keys()].sort();
  const first = [start ? monthKey(start) : null, dataMonths[0]].filter(Boolean).sort()[0] ?? now;
  const last = [end ? monthKey(end) : null, now, dataMonths.at(-1)].filter(Boolean).sort().at(-1)!;
  const months = monthsBetween(first, last);

  // Future-dated data (e.g. a record dated ahead) still counts toward the
  // measured total, so the forecast starts from everything recorded.
  const actualToDate = [...byMonth.values()].reduce((t, v) => t + v, 0);
  const pastMonths = months.filter((m) => m <= now);
  const recent = pastMonths.slice(-3);
  const hasHistory = pastMonths.some((m) => byMonth.has(m));
  const runRatePerMonth = hasHistory && recent.length ? recent.reduce((t, m) => t + (byMonth.get(m) ?? 0), 0) / recent.length : null;
  const remaining = end ? months.filter((m) => m > now && m <= monthKey(end)).length : 0;

  let method: ForecastMethod = "none";
  let forecastAtCompletion: number | null = null;
  if (input.evm && input.evm.method === "cpi_trend") {
    method = "evm";
    forecastAtCompletion = input.evm.forecastAtCompletionTco2e;
  } else if (end && runRatePerMonth != null) {
    method = "run_rate";
    forecastAtCompletion = actualToDate + runRatePerMonth * remaining;
  }

  const plannedToDate = start && end ? budgetTco2e * elapsedShare(now, start, end) : null;

  let cumulative = 0;
  const points: BurndownPoint[] = months.map((month) => {
    const past = month <= now;
    const actual = past ? byMonth.get(month) ?? 0 : null;
    if (past) cumulative += actual ?? 0;
    return {
      month,
      actual,
      cumulativeActual: past ? cumulative : null,
      plannedCumulative: start && end ? budgetTco2e * elapsedShare(month, start, end) : null,
      forecastCumulative: null,
    };
  });
  if (forecastAtCompletion != null && end) {
    const future = points.filter((p) => p.month > now && p.month <= monthKey(end));
    const step = future.length ? (forecastAtCompletion - cumulative) / future.length : 0;
    future.forEach((p, i) => (p.forecastCumulative = cumulative + step * (i + 1)));
    const lastPast = [...points].reverse().find((p) => p.month <= now);
    if (lastPast && future.length) lastPast.forecastCumulative = lastPast.cumulativeActual;
  }

  const reasons: string[] = [];
  let status: BudgetStatus = budgetTco2e > 0 ? "on_track" : "no_budget";
  if (budgetTco2e > 0) {
    if (actualToDate > budgetTco2e) {
      status = "over";
      reasons.push("Measured carbon already exceeds the budget.");
    } else if (forecastAtCompletion != null && forecastAtCompletion > budgetTco2e) {
      status = "over";
      reasons.push(`Forecast at completion is ${(forecastAtCompletion - budgetTco2e).toFixed(1)} tCO2e over budget.`);
    } else if (forecastAtCompletion != null && forecastAtCompletion > budgetTco2e * AT_RISK_SHARE) {
      status = "at_risk";
      reasons.push(`Forecast at completion uses ${((forecastAtCompletion / budgetTco2e) * 100).toFixed(0)}% of the budget.`);
    }
    if (status !== "over" && plannedToDate != null && plannedToDate > 0 && actualToDate > plannedToDate * AHEAD_OF_PLAN_SHARE) {
      status = "at_risk";
      reasons.push(`Carbon to date is ${(((actualToDate / plannedToDate) - 1) * 100).toFixed(0)}% ahead of the planned spend for this point in the project.`);
    }
  }

  return {
    budgetTco2e,
    actualToDate,
    plannedToDate,
    runRatePerMonth,
    forecastAtCompletion,
    method,
    varianceAtCompletion: forecastAtCompletion != null ? budgetTco2e - forecastAtCompletion : null,
    status,
    reasons,
    points,
  };
}

const RANK: Record<BudgetStatus, number> = { no_budget: 0, on_track: 0, at_risk: 1, over: 2 };
/** Whether moving from `previous` to `next` should alert (only when it gets worse). */
export const escalates = (previous: string | null, next: BudgetStatus) => RANK[next] > RANK[(previous as BudgetStatus) ?? "on_track"];
