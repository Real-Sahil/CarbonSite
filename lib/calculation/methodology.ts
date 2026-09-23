// Methodology versioning policy.
//
// A methodology version names the calculation rules, not the data. Every
// calculation run records the version it used (CalculationRun.methodologyVersion,
// denormalised onto each EmissionCalculation), and the newest
// methodology_versions row is the one new runs use.
//
// Bump the version (new row, name ghg-protocol-v<year>-<nn>, added by a
// migration, with an entry below) when a change can alter a figure calculated
// from the same records and the same factor library:
//   - global warming potentials (e.g. AR6 to AR7);
//   - the Scope 2 market-based allocation order or residual mix rules;
//   - how spend is converted or inflation-adjusted;
//   - fuel, blend or unit conversion rules (HVO, calorific values);
//   - what counts toward headline totals.
// Do not bump for a new or corrected factor library (each run pins its
// library, and supersedingLibrary() flags replaced sets), for UI or report
// layout changes, or for bug fixes that restore the documented behaviour.
//
// On a bump: published snapshots keep the version they were calculated
// with; the dashboard lists each period whose latest snapshot used an older
// version (outdatedMethodology below) with this changelog, and customers are
// told through the release notes. Nothing is recalculated automatically.

export type MethodologyChange = { name: string; effective: string; gwp: string; changes: string[] };

/** Newest first. The first entry must match the newest methodology_versions row. */
export const METHODOLOGY_CHANGELOG: MethodologyChange[] = [
  {
    name: "ghg-protocol-v2026-01",
    effective: "2026-08-07",
    gwp: "AR6",
    changes: [
      "GHG Protocol Corporate Standard with IPCC AR6 100-year GWPs (CH4 27.9, N2O 273).",
      "Scope 2 dual reporting: headline totals use location-based; market-based allocates certificates, PPAs, green tariffs, supplier rate, then residual mix.",
      "Spend converted at the ECB rate for the record's date and deflated to the factor's price year where one is stated.",
      "HVO and biofuel blends priced from the library's HVO and diesel factors; biogenic CO2 reported outside the scopes.",
    ],
  },
];

export function methodologyChange(name: string): MethodologyChange | null {
  return METHODOLOGY_CHANGELOG.find((m) => m.name === name) ?? null;
}

/**
 * Periods whose latest published snapshot was calculated under a methodology
 * other than the current one. `snapshots` must be ordered so each period's
 * latest version comes first.
 */
export function outdatedMethodology<T extends { reportingPeriodId: string; version: number; periodLabel: string; methodology: string | null }>(
  snapshots: T[],
  current: string | null,
): { period: string; version: number; used: string; current: string; changes: string[] }[] {
  if (!current) return [];
  const seen = new Set<string>();
  const out: { period: string; version: number; used: string; current: string; changes: string[] }[] = [];
  for (const s of snapshots) {
    if (seen.has(s.reportingPeriodId)) continue;
    seen.add(s.reportingPeriodId);
    if (s.methodology && s.methodology !== current) {
      out.push({ period: s.periodLabel, version: s.version, used: s.methodology, current, changes: methodologyChange(current)?.changes ?? [] });
    }
  }
  return out;
}
