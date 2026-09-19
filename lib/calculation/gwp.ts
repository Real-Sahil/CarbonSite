// Single source of truth for Global Warming Potential values.
//
// Source: IPCC Sixth Assessment Report (AR6), Working Group I, Chapter 7,
// Table 7.15 — GWP over a 100-year time horizon, relative to CO2.
//
// CH4 = 27.9 is the AR6 emission-weighted global average for methane. AR6 also
// publishes a split by source that this blended figure averages over:
//   fossil methane      29.8
//   non-fossil methane  27.2
// The blended value is what UK and EU reporting practice applies where the
// methane source is not separated in the activity data, which is the case for
// every factor library seeded here (DEFRA, EPA, SustainMetrics all publish a
// single CH4 term per fuel). Splitting by source would require source-tagged
// factors; until the libraries provide them, the blend is the defensible
// choice and this note is the audit trail for that decision.
//
// Changing any value here changes every calculated figure, so it must be
// accompanied by a new MethodologyVersion — published snapshots are immutable
// and must remain reproducible under the methodology they were run with.
export const GWP_AR6 = {
  CH4: 27.9,
  N2O: 273,
  CF4: 6630,
  C2F6: 11100,
  HFC134a: 1526,
  SF6: 25200,
} as const;

/// AR6 methane GWP split by source, for reference and for factor libraries
/// that tag the methane source. Not applied by the default pipeline — see the
/// note above.
export const GWP_AR6_CH4_BY_SOURCE = {
  fossil: 29.8,
  nonFossil: 27.2,
} as const;
