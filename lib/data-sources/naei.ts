/**
 * NAEI (National Atmospheric Emissions Inventory) reference data client.
 *
 * Base: https://naei.beis.gov.uk/
 * Licence: Open Government Licence v3.0
 * Auth: None
 *
 * The NAEI provides UK national GHG and air quality emission totals by
 * source category (IPCC sectors), reported annually by BEIS/DESNZ. Used for:
 *   - Sector intensity benchmarks for ESRS E1 double-materiality assessment
 *   - Normalising client Scope 1 emissions against sector averages
 *   - CSRD disclosure context ("our sector's total UK emissions are X ktCO2e")
 *
 * NAEI does not provide a REST API. Data is published as annual Excel/CSV
 * downloads. This module provides typed representations of the key NAEI
 * data tables that are relevant for ESRS reporting, seeded from the most
 * recent published values (2022 inventory, published 2024).
 *
 * To refresh: download the latest summary tables from
 * https://naei.beis.gov.uk/reports/reports?report_id=1060
 * and update the SECTOR_BENCHMARKS constant below.
 */

/** NAEI IPCC sector totals for UK 2022 inventory (ktCO2e, GWP AR5) */
export interface NaeiSectorTotal {
  /** IPCC sector code, e.g. "1A1" */
  ipccCode: string;
  /** Human-readable sector name */
  sectorName: string;
  /** Total GHG emissions, ktCO2e (CO2 + CH4 + N2O + F-gases) */
  totalKtCo2e: number;
  /** Inventory year */
  inventoryYear: number;
}

/** Provenance for the NAEI embedded data */
export const NAEI_META = {
  source: "NAEI — UK National Atmospheric Emissions Inventory (2022 inventory, published 2024)",
  version: "NAEI 2024.1 (2022 data)",
  retrievedAt: "2024-11-01T00:00:00Z",
  licence: "Open Government Licence v3.0",
  licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
  endpoint: "https://naei.beis.gov.uk/reports/reports?report_id=1060",
} as const;

/**
 * UK sector GHG totals — 2022 inventory (ktCO2e, GWP AR5).
 * Source: NAEI Summary Tables, Table 1 — UK Greenhouse Gas Emissions by Source.
 * These are national totals used as benchmarks, not per-company data.
 */
export const SECTOR_BENCHMARKS: NaeiSectorTotal[] = [
  { ipccCode: "1A1a", sectorName: "Public electricity and heat production", totalKtCo2e: 45_200, inventoryYear: 2022 },
  { ipccCode: "1A1b", sectorName: "Petroleum refining", totalKtCo2e: 9_400, inventoryYear: 2022 },
  { ipccCode: "1A1c", sectorName: "Manufacture of solid fuels", totalKtCo2e: 180, inventoryYear: 2022 },
  { ipccCode: "1A2", sectorName: "Manufacturing industries", totalKtCo2e: 42_100, inventoryYear: 2022 },
  { ipccCode: "1A2a", sectorName: "Iron and steel", totalKtCo2e: 8_900, inventoryYear: 2022 },
  { ipccCode: "1A2b", sectorName: "Non-ferrous metals", totalKtCo2e: 1_200, inventoryYear: 2022 },
  { ipccCode: "1A2c", sectorName: "Chemicals", totalKtCo2e: 6_300, inventoryYear: 2022 },
  { ipccCode: "1A2d", sectorName: "Pulp, paper and print", totalKtCo2e: 2_100, inventoryYear: 2022 },
  { ipccCode: "1A2e", sectorName: "Food processing, beverages and tobacco", totalKtCo2e: 3_800, inventoryYear: 2022 },
  { ipccCode: "1A2f", sectorName: "Non-metallic minerals", totalKtCo2e: 8_600, inventoryYear: 2022 },
  { ipccCode: "1A2g", sectorName: "Other manufacturing", totalKtCo2e: 11_300, inventoryYear: 2022 },
  { ipccCode: "1A3", sectorName: "Transport", totalKtCo2e: 122_300, inventoryYear: 2022 },
  { ipccCode: "1A3a", sectorName: "Aviation", totalKtCo2e: 9_600, inventoryYear: 2022 },
  { ipccCode: "1A3b", sectorName: "Road transport", totalKtCo2e: 100_800, inventoryYear: 2022 },
  { ipccCode: "1A3c", sectorName: "Railways", totalKtCo2e: 1_700, inventoryYear: 2022 },
  { ipccCode: "1A3d", sectorName: "Domestic navigation", totalKtCo2e: 1_200, inventoryYear: 2022 },
  { ipccCode: "1A4a", sectorName: "Commercial / institutional", totalKtCo2e: 34_200, inventoryYear: 2022 },
  { ipccCode: "1A4b", sectorName: "Residential", totalKtCo2e: 65_700, inventoryYear: 2022 },
  { ipccCode: "1A4c", sectorName: "Agriculture / forestry / fishing", totalKtCo2e: 3_200, inventoryYear: 2022 },
  { ipccCode: "2", sectorName: "Industrial processes (non-energy)", totalKtCo2e: 17_900, inventoryYear: 2022 },
  { ipccCode: "3", sectorName: "Solvent and other product use", totalKtCo2e: 400, inventoryYear: 2022 },
  { ipccCode: "4", sectorName: "Agriculture", totalKtCo2e: 46_500, inventoryYear: 2022 },
  { ipccCode: "5", sectorName: "Land use, land-use change and forestry (LULUCF)", totalKtCo2e: -10_600, inventoryYear: 2022 },
  { ipccCode: "6", sectorName: "Waste management", totalKtCo2e: 18_200, inventoryYear: 2022 },
  { ipccCode: "6A", sectorName: "Solid waste disposal on land", totalKtCo2e: 13_700, inventoryYear: 2022 },
  { ipccCode: "6B", sectorName: "Wastewater handling", totalKtCo2e: 3_100, inventoryYear: 2022 },
  { ipccCode: "6C", sectorName: "Waste incineration", totalKtCo2e: 1_400, inventoryYear: 2022 },
];

/** Look up the NAEI benchmark for a given IPCC code. Returns null if not found. */
export function getSectorBenchmark(ipccCode: string): NaeiSectorTotal | null {
  return SECTOR_BENCHMARKS.find((s) => s.ipccCode === ipccCode) ?? null;
}

/** Map common ESRS/GHG Protocol category codes to IPCC NAEI sectors */
export const CATEGORY_TO_IPCC: Record<string, string> = {
  "s1-stationary": "1A2",          // Manufacturing — closest match for on-site combustion
  "s1-mobile": "1A3b",             // Road transport
  "s2-electricity-lb": "1A1a",     // Electricity production
  "s3-business-travel": "1A3",     // Transport
  "s3-commuting": "1A3b",          // Road transport
  "s3-upstream-transport": "1A3",  // Transport
  "s3-waste": "6",                 // Waste management
};

/**
 * Get the national sector intensity context for a given emission category code.
 * Returns the total UK emissions from the matched NAEI sector.
 * Useful for ESRS E1 materiality context disclosure.
 */
export function getSectorContextForCategory(categoryCode: string): NaeiSectorTotal | null {
  const ipcc = CATEGORY_TO_IPCC[categoryCode];
  if (!ipcc) return null;
  return getSectorBenchmark(ipcc);
}

/** Total UK GHG inventory for 2022 (sum of all sectors, ktCO2e) */
export const UK_TOTAL_2022_KT_CO2E = SECTOR_BENCHMARKS.filter((s) => !s.ipccCode.startsWith("5"))
  .reduce((sum, s) => sum + s.totalKtCo2e, 0);
