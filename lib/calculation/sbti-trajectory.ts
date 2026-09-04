// Science Based Targets initiative (SBTi) trajectory — the year-by-year
// expected emissions line implied by a committed SbtiTarget, compared
// against what the organisation's own DashboardAggregate data actually
// shows for each year. This is what turns "we said we'd hit 50% by 2030"
// into a checkable claim rather than a slogan sitting next to a chart of
// its own targets.
//
// Consolidates what were previously three separate, drifted
// implementations (a simple expected-only trajectory wired to the live
// /sbti page, and a richer actual-vs-target trajectory + a deviation
// alerts route, both unused) into one.

export interface SbtiTargetInput {
  pathway: string;
  baseYear: number;
  baselineScope1Tco2e: number;
  baselineScope2Tco2e: number;
  baselineScope3Tco2e: number | null;
  nearTermYear: number;
  nearTermReductionPct: number;
  netZeroYear: number;
  netZeroReductionPct: number;
}

export type SbtiMilestone = "baseline" | "near_term" | "net_zero";
export type SbtiYearStatus = "on_track" | "behind" | "no_data" | "future";

export interface SbtiTrajectoryPoint {
  year: number;
  /** tCO2e the pathway implies for this year — linear from base to
   * near-term, then near-term to net-zero. Never negative. */
  expectedTco2e: number;
  /** tCO2e actually reported for this year, from DashboardAggregate. Null
   * when the year has no data yet (including future years). */
  actualTco2e: number | null;
  /** actual - expected. Positive means over the line (behind). Null when
   * there is no actual to compare. */
  deviationTco2e: number | null;
  deviationPercent: number | null;
  milestone: SbtiMilestone;
  status: SbtiYearStatus;
}

export function baselineTotalTco2e(target: SbtiTargetInput): number {
  return (
    target.baselineScope1Tco2e +
    target.baselineScope2Tco2e +
    (target.baselineScope3Tco2e ?? 0)
  );
}

/** The pathway's expected tCO2e for one year — linear base→near-term→net-zero. */
export function expectedTco2eForYear(target: SbtiTargetInput, year: number): number {
  const baseTotal = baselineTotalTco2e(target);
  const nearTermTarget = baseTotal * (1 - target.nearTermReductionPct / 100);
  const netZeroTarget = baseTotal * (1 - target.netZeroReductionPct / 100);

  if (year <= target.baseYear) return baseTotal;
  if (year <= target.nearTermYear) {
    const span = target.nearTermYear - target.baseYear;
    const progress = span > 0 ? (year - target.baseYear) / span : 1;
    return Math.max(0, baseTotal - progress * (baseTotal - nearTermTarget));
  }
  const span = target.netZeroYear - target.nearTermYear;
  const progress = span > 0 ? (year - target.nearTermYear) / span : 1;
  return Math.max(0, nearTermTarget - progress * (nearTermTarget - netZeroTarget));
}

function milestoneForYear(target: SbtiTargetInput, year: number): SbtiMilestone {
  if (year <= target.baseYear) return "baseline";
  if (year <= target.nearTermYear) return "near_term";
  return "net_zero";
}

/**
 * Builds the full trajectory from base year to net-zero year, folding in
 * whatever actual totals the caller has for each year.
 *
 * A 5% band either side of the expected line is treated as "on track" —
 * the same tolerance used elsewhere in the codebase for judging a
 * recalculated total against a threshold (see isSignificant() in
 * lib/inventory/base-year.ts): real inventories don't land exactly on a
 * straight line, and flagging every rounding difference as "behind" would
 * make the status meaningless.
 */
export function buildSbtiTrajectory(
  target: SbtiTargetInput,
  actualByYear: Map<number, number>,
): SbtiTrajectoryPoint[] {
  const currentYear = new Date().getFullYear();
  const points: SbtiTrajectoryPoint[] = [];

  for (let year = target.baseYear; year <= target.netZeroYear; year++) {
    const expectedTco2e = expectedTco2eForYear(target, year);
    const actualTco2e = actualByYear.get(year) ?? null;

    let deviationTco2e: number | null = null;
    let deviationPercent: number | null = null;
    let status: SbtiYearStatus;

    if (actualTco2e != null) {
      deviationTco2e = actualTco2e - expectedTco2e;
      deviationPercent = expectedTco2e > 0 ? (deviationTco2e / expectedTco2e) * 100 : 0;
      status = deviationPercent > 5 ? "behind" : "on_track";
    } else {
      status = year > currentYear ? "future" : "no_data";
    }

    points.push({
      year,
      expectedTco2e,
      actualTco2e,
      deviationTco2e,
      deviationPercent,
      milestone: milestoneForYear(target, year),
      status,
    });
  }

  return points;
}

export interface SbtiAlert {
  severity: "critical" | "warning" | "info";
  year: number;
  message: string;
}

/**
 * Deviation alerts derived from the trajectory — one per year that is
 * behind, escalating with how far behind and how close the next milestone
 * is. Only looks at years with real data (no_data/future years have
 * nothing to alert on).
 */
export function buildSbtiAlerts(
  target: SbtiTargetInput,
  trajectory: SbtiTrajectoryPoint[],
): SbtiAlert[] {
  const alerts: SbtiAlert[] = [];

  for (const point of trajectory) {
    if (point.status !== "behind" || point.deviationPercent == null) continue;

    const yearsToMilestone =
      point.milestone === "near_term"
        ? target.nearTermYear - point.year
        : target.netZeroYear - point.year;

    const severity: SbtiAlert["severity"] =
      point.deviationPercent > 25 || yearsToMilestone <= 1
        ? "critical"
        : point.deviationPercent > 10
          ? "warning"
          : "info";

    const milestoneLabel = point.milestone === "near_term" ? "near-term" : "net-zero";
    alerts.push({
      severity,
      year: point.year,
      message:
        `${point.year} actual emissions are ${point.deviationPercent.toFixed(1)}% above the ` +
        `pathway (${Math.round(point.actualTco2e ?? 0).toLocaleString("en-GB")} vs ` +
        `${Math.round(point.expectedTco2e).toLocaleString("en-GB")} tCO2e expected), ` +
        `${yearsToMilestone} year${yearsToMilestone === 1 ? "" : "s"} from the ${milestoneLabel} milestone.`,
    });
  }

  return alerts;
}
