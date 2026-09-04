// Carbon Earned Value Management — the standard ANSI/PMI earned value
// formulas (BAC, EV, AC, CPI, EAC, VAC), with "cost" substituted for
// "carbon" throughout. This is a documented technique in sustainable
// construction management (tracking a carbon budget the same way a cost
// budget is tracked, rather than only comparing spend-to-date against
// budget-to-date, which hides whether the work actually done is
// efficient).
//
// Terms, carried over directly from cost-based EVM:
//   BAC (Budget at Completion)   — the total carbon budget across all phases.
//   EV  (Earned Value)           — the budget VALUE of the work actually
//                                   completed: sum(phase budget × % complete).
//                                   This is not the same as actual emissions —
//                                   it is what completing that fraction of the
//                                   phase was BUDGETED to cost in carbon.
//   AC  (Actual Cost)            — the carbon actually emitted so far.
//   CPI (Cost/Carbon Performance
//        Index)                  — EV / AC. Above 1 means the work done so
//                                   far cost less carbon than budgeted for
//                                   that amount of work; below 1 means it
//                                   cost more.
//   EAC (Estimate at Completion) — the forecast total carbon at completion.
//   VAC (Variance at Completion) — BAC - EAC: positive means forecast to
//                                   finish under budget.

export interface EvmPhaseInput {
  budgetTco2e: number;
  actualTco2e: number;
  /** 0-100, manually reconciled — see CarbonBudgetPhase.percentComplete. */
  percentComplete: number;
}

export interface EvmResult {
  budgetAtCompletionTco2e: number;
  earnedValueTco2e: number;
  actualTco2e: number;
  /** null when actualTco2e is 0 — CPI is undefined with no denominator. */
  cpi: number | null;
  percentCompleteOverall: number;
  /**
   * "cpi_trend" — CPI-based forecast (BAC / CPI), used once there is enough
   * actual data for the trend to be meaningful.
   * "linear_no_trend" — AC + (BAC - EV), assumes the remaining work goes
   * exactly to budget. Used when CPI is undefined or the project is too
   * early (< the minimumTrendPercentComplete threshold) for a performance
   * trend to be a reliable extrapolation — the same caution the PMI EVM
   * standard gives for early-stage CPI readings.
   */
  method: "cpi_trend" | "linear_no_trend";
  forecastAtCompletionTco2e: number;
  varianceAtCompletionTco2e: number;
}

const MINIMUM_TREND_PERCENT_COMPLETE = 10;

export function computeCarbonEvm(
  phases: EvmPhaseInput[],
  options: { minimumTrendPercentComplete?: number } = {},
): EvmResult {
  const minimumTrendPercentComplete =
    options.minimumTrendPercentComplete ?? MINIMUM_TREND_PERCENT_COMPLETE;

  const budgetAtCompletionTco2e = phases.reduce((sum, p) => sum + p.budgetTco2e, 0);
  const actualTco2e = phases.reduce((sum, p) => sum + p.actualTco2e, 0);
  const earnedValueTco2e = phases.reduce(
    (sum, p) => sum + p.budgetTco2e * (clampPercent(p.percentComplete) / 100),
    0,
  );

  const cpi = actualTco2e > 0 ? earnedValueTco2e / actualTco2e : null;
  const percentCompleteOverall =
    budgetAtCompletionTco2e > 0 ? (earnedValueTco2e / budgetAtCompletionTco2e) * 100 : 0;

  const canUseTrend = cpi != null && cpi > 0 && percentCompleteOverall >= minimumTrendPercentComplete;

  const method: EvmResult["method"] = canUseTrend ? "cpi_trend" : "linear_no_trend";
  const forecastAtCompletionTco2e = canUseTrend
    ? budgetAtCompletionTco2e / (cpi as number)
    : actualTco2e + (budgetAtCompletionTco2e - earnedValueTco2e);

  return {
    budgetAtCompletionTco2e,
    earnedValueTco2e,
    actualTco2e,
    cpi,
    percentCompleteOverall,
    method,
    forecastAtCompletionTco2e,
    varianceAtCompletionTco2e: budgetAtCompletionTco2e - forecastAtCompletionTco2e,
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
