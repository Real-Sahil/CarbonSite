/**
 * Number formatting for the dashboard KPI cards. Kept out of the client component so the server page can
 * format with the same rules, and so a KPI spec (a plain object) can cross the server/client boundary.
 */
export type KpiFormat =
  | { kind: "co2e"; locale: string }
  | { kind: "percent" }
  | { kind: "scopes"; of: number };

/** kgCO₂e below a tonne, tCO₂e above. Same rule as the dashboard's other emissions figures. */
export function formatKgCo2e(locale: string, value: unknown): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "0 kgCO₂e";
  if (numeric >= 1000) return `${(numeric / 1000).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tCO₂e`;
  return `${numeric.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kgCO₂e`;
}

export function formatKpi(format: KpiFormat, value: number): string {
  switch (format.kind) {
    case "co2e":
      return formatKgCo2e(format.locale, value);
    case "percent":
      return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
    case "scopes":
      return `${Math.round(value)}/${format.of}`;
  }
}
