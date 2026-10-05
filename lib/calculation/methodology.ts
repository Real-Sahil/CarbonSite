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
//   - what counts toward headline totals;
//   - which library prices a record when the run's own library has no factor.
// Do not bump for a new or corrected factor library (each run pins its
// library, and supersedingLibrary() flags replaced sets), for UI or report
// layout changes, or for bug fixes that restore the documented behaviour.
//
// On a bump: published snapshots keep the version they were calculated
// with; the dashboard lists each period whose latest snapshot used an older
// version (outdatedMethodology below) with this changelog, and customers are
// told through the release notes. Nothing is recalculated automatically.

/** `summary` is the plain-language line shown on the public methodology page; `changes` is the full account for customers, auditors and the assurance pack. */
export type MethodologyChange = { name: string; effective: string; gwp: string; summary: string; changes: string[] };

/** Newest first. The first entry must match the newest methodology_versions row. */
export const METHODOLOGY_CHANGELOG: MethodologyChange[] = [
  {
    name: "ghg-protocol-v2026-05",
    summary: "National factor sets for more countries, regional electricity where a site's location is known, and sharper fuel matching.",
    effective: "2026-10-05",
    gwp: "AR6",
    changes: [
      "Library fallback now also applies to runs on the national libraries NGA Factors (Australia), ECCC (Canada, electricity only), UBA (Germany) and SEAI (Ireland): a record the run's library has no factor for is priced from DEFRA, then ADEME, with a warning. Grid electricity and heat still never fall back.",
      "Australian and Canadian electricity: a state or province grid factor is used when the record's fuel/detail text or its facility's region names it; every other record in that country takes the national factor. Before this, no state or province rows existed. Western Australia is read as the South West Interconnected System unless the North West one is named.",
      "A fuel word in a record's detail text must now start a word in the factor's text: \"diesel\" no longer matches \"biodiesel\". Before this, a record naming diesel could be priced with a biodiesel factor when a library listed both.",
    ],
  },
  {
    name: "ghg-protocol-v2026-04",
    summary: "A record the chosen factor set cannot price now uses a clearly labelled alternative, flagged on the result, instead of being left at zero.",
    effective: "2026-10-05",
    gwp: "AR6",
    changes: [
      "A record on an EPA run that the EPA library has no factor for (and that is not grid electricity or purchased heat) is priced from the DEFRA set for the period, then ADEME, when that library has a factor whose unit takes the record's unit. Before this it was saved at 0 kg CO2e. The calculation's selection reason starts \"fallback library\", names the library and warns when the factor is another country's. Grid electricity and heat never fall back: a national grid factor on another country's site would be wrong.",
    ],
  },
  {
    name: "ghg-protocol-v2026-03",
    summary: "Gallons are now read according to the record's country.",
    effective: "2026-10-05",
    gwp: "AR6",
    changes: [
      'A bare "gallon" or "gallons" is read as a US gallon (3.785 L) for a record whose country is the United States, and as an imperial gallon (4.546 L) elsewhere. Before this, every bare gallon was imperial, which overstated US fuel by about 20%. The calculation says which gallon was used; "US gallons" and "UK gallons" are never reinterpreted.',
    ],
  },
  {
    name: "ghg-protocol-v2026-02",
    summary: "Spend is priced by supplier industry where known, heat and cooling are counted in Scope 2, and inflation adjustment covers more currencies.",
    effective: "2026-09-24",
    gwp: "AR6",
    changes: [
      "Spend that names its supplier's industry code is priced from the sourced spend library for its currency (Defra UK multipliers by UK SIC for GBP, EPA USEEIO by NAICS for USD, ADEME by NAF for EUR) when the run's library has no industry factor, instead of a generic spend factor.",
      "EUR spend is deflated with the euro area HICP, or France's own HICP for French spend factors; the US 2025 CPI is BLS's published annual average.",
      "Fuel quantities on a net calorific value basis (kWh PCI, GJ/MJ PCI, toe) are their own unit and match only net-CV factors.",
      "Purchased heat, steam and cooling (s2-heat) counts toward location-based Scope 2, and also toward the market-based total when there is market-based electricity.",
    ],
  },
  {
    name: "ghg-protocol-v2026-01",
    summary: "First version: GHG Protocol Corporate Standard, IPCC AR6 warming potentials, location- and market-based Scope 2 side by side.",
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
