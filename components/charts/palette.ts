// Shared chart palette and formatters for emissions analytics.
// All chart inputs are kgCO2e (the storage unit for EmissionCalculation.totalCo2e
// and DashboardAggregate.totalCo2e) — display is always converted to tCO2e.

/** Hardcoded hex fallbacks — used on SSR and when CSS vars are unavailable. */
export const SCOPE_COLORS: Record<number, string> = {
  1: "#0f766e", // teal-700 — matches --color-scope-1
  2: "#0ea5e9", // sky-500  — matches --color-scope-2
  3: "#84cc16", // lime-500 — matches --color-scope-3
};

/** CSS custom property names for scope colours (defined in globals.css @theme). */
const SCOPE_CSS_VARS: Record<1 | 2 | 3, string> = {
  1: "--color-scope-1",
  2: "--color-scope-2",
  3: "--color-scope-3",
};

/**
 * Returns the resolved colour for the given scope number.
 * In browser environments, reads the CSS custom property from :root so tenant
 * branding overrides are respected. Falls back to the hardcoded SCOPE_COLORS
 * hex on the server (SSR) or when the property is unset.
 */
export function getScopeColor(scope: 1 | 2 | 3): string {
  if (typeof document !== "undefined") {
    const cssVar = SCOPE_CSS_VARS[scope];
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVar)
      .trim();
    if (resolved) return resolved;
  }
  return SCOPE_COLORS[scope];
}

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
