// Shared chart palette and formatters for emissions analytics.
// All chart inputs are kgCO2e (the storage unit for EmissionCalculation.totalCo2e
// and DashboardAggregate.totalCo2e) — display is always converted to tCO2e.

/**
 * The one scope palette for every chart in the app and on the marketing site.
 * Matches --color-scope-1..3 in globals.css. Checked with the dataviz palette
 * validator (lightness band, chroma floor, colour-blind separation, contrast)
 * on light and dark surfaces, all pairs: the previous teal/green pair was too
 * close to tell apart. Marks only: text stays in text colours.
 */
export const SCOPE_COLORS: Record<number, string> = {
  1: "#0B8F80", // teal  — --color-scope-1
  2: "#E0692A", // ember — --color-scope-2
  3: "#3B6FD4", // blue  — --color-scope-3
};

export const SCOPE_LABELS: Record<number, string> = {
  1: "Scope 1",
  2: "Scope 2",
  3: "Scope 3",
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

export const DEFAULT_SERIES_COLOR = "#0B8F80";

/** Anything that is not a scope (a total, a facility). */
export const NEUTRAL_SERIES_COLOR = "#475569";

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

/** A tonnes figure (already in t) for labels: "4,710.05". */
export function formatTonnesValue(t: number, fractionDigits = 2): string {
  if (!Number.isFinite(t)) return "0";
  return t.toLocaleString("en-GB", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
