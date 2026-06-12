// Shared chart palette and formatters for emissions analytics.
// All chart inputs are kgCO2e (the storage unit for EmissionCalculation.totalCo2e
// and DashboardAggregate.totalCo2e) — display is always converted to tCO2e.

export const SCOPE_COLORS: Record<number, string> = {
  1: "#0f766e", // teal-700
  2: "#0ea5e9", // sky-500
  3: "#84cc16", // lime-500
};

export const DEFAULT_SERIES_COLOR = "#0f766e";

export const AXIS_TICK = { fill: "#64748b", fontSize: 12 } as const;

export const GRID_STROKE = "#e2e8f0";

export function scopeColor(scope: number | undefined): string {
  return (scope != null && SCOPE_COLORS[scope]) || DEFAULT_SERIES_COLOR;
}

/** Format a kgCO2e value as "X.XX tCO2e". */
export function formatTonnes(kg: number): string {
  if (!Number.isFinite(kg)) return "0.00 tCO2e";
  return `${(kg / 1000).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} tCO2e`;
}

/** Compact axis tick: kgCO2e in, tonnes out (no unit suffix — axis is labelled). */
export function tonnesTick(kg: number): string {
  return (kg / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 });
}
