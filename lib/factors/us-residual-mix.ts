// US residual mix: the emission rate of untracked, unclaimed electricity in each
// eGRID subregion once voluntary renewable purchases are taken out. Under the
// GHG Protocol Scope 2 Guidance it is the rate for market-based electricity that
// no certificate, PPA or supplier rate covers.
//
// Source: Center for Resource Solutions (CRS), "2025 Residual Mix Emissions
// Rates (2023 Data)", released 29 January 2026, https://resource-solutions.org/2025-residual-mix/
// (column "Adjusted System Mix", lb/MWh, 12-month vintage). CRS asks that users
// of the rates cite them in their accounting; the instrument created from one
// carries the citation. No licence or terms of use were found on the page; see
// docs/THIRD_PARTY_SOURCES.md. Update each year when CRS publishes (about
// January) and keep the release in RESIDUAL_MIX_RELEASE.
//
// Entered as an organisation's own contract instrument (Settings > Electricity
// contracts): never applied silently, because whether it is the right residual
// for a site's market is the organisation's call.

export const RESIDUAL_MIX_RELEASE = {
  label: "CRS Residual Mix Emissions Rates, 2025 release (2023 data)",
  url: "https://resource-solutions.org/2025-residual-mix/",
  released: "2026-01-29",
};

const LB_TO_KG = 0.45359237;

/** Adjusted system mix, lb/MWh, as published. */
const LB_PER_MWH: Record<string, number> = {
  AKGD: 914.6413586, AKMS: 532.7287751, AZNM: 707.7328763, CAMX: 434.2188489, ERCT: 823.8111702,
  FRCC: 801.2358505, HIMS: 1133.294113, HIOA: 1498.94716, MROE: 1405.429311, MROW: 977.8804858,
  NEWE: 543.2319202, NWPP: 656.5346459, NYCW: 865.7438474, NYLI: 1189.33315, NYUP: 242.7997119,
  PRMS: 1548.53042, RFCE: 599.2376521, RFCM: 988.6575128, RFCW: 917.7836884, RMPA: 1065.862366,
  SPNO: 1016.819182, SPSO: 1020.77061, SRMV: 744.9573566, SRMW: 1287.869423, SRSO: 855.1031963,
  SRTV: 903.7201505, SRVC: 601.8887958,
};

/** kg per kWh for an eGRID subregion code, or null if CRS publishes none for it. */
export function residualMixKgPerKwh(code: string | null | undefined): number | null {
  const lb = LB_PER_MWH[(code ?? "").toUpperCase()];
  return lb == null ? null : Number(((lb * LB_TO_KG) / 1000).toFixed(6));
}

export const RESIDUAL_MIX_CODES = Object.keys(LB_PER_MWH);
