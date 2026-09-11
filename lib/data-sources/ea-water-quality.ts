/**
 * EA Water Quality Archive API client.
 *
 * Base: https://environment.data.gov.uk/water-quality/
 * Docs: https://environment.data.gov.uk/water-quality/
 * Licence: Open Government Licence v3.0
 * Auth: None
 *
 * Provides chemical and biological water quality measurements from EA
 * sampling points across England. Used for ESRS E3 water quality KPIs,
 * discharge consent monitoring, and receiving-water benchmarking.
 */

import { DataSourceResult, OGL_V3, govFetch } from "./types";

const BASE = "https://environment.data.gov.uk/water-quality";

export interface WaterSamplingPoint {
  notation: string;
  label: string;
  lat?: number;
  long?: number;
  waterbodyType?: string;
  eaAreaName?: string;
}

export interface WaterQualityDeterminand {
  notation: string;
  label: string;
  /** SI unit of measurement */
  unit?: string;
  definition?: string;
}

export interface WaterQualityMeasurement {
  samplingPoint: string;
  samplingPointLabel?: string;
  sample: string;
  sampleDateTime: string;
  determinand: string;
  determinandLabel?: string;
  result: number;
  unit: string;
  isComplianceSample?: boolean;
}

/** Find sampling points within `distKm` of a lat/lng */
export async function getSamplingPointsNear(
  lat: number,
  lng: number,
  distKm = 5,
): Promise<DataSourceResult<WaterSamplingPoint[]>> {
  const url = `${BASE}/data/sampling-point?lat=${lat}&long=${lng}&dist=${distKm}&_limit=50`;
  const resp = await govFetch(url);
  if (!resp.ok) throw new Error(`EA Water Quality API ${resp.status}: ${url}`);
  const json = (await resp.json()) as { items: WaterSamplingPoint[] };
  return {
    data: json.items ?? [],
    meta: {
      ...OGL_V3,
      source: "EA Water Quality Archive API",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/**
 * Get recent water quality measurements for a sampling point.
 *
 * @param samplingPointNotation  The EA notation code for the sampling point.
 * @param determinandNotations   Filter to specific determinands (e.g. "0116" = COD, "0007" = BOD5).
 * @param startDate              ISO date string, default last 12 months.
 */
export async function getMeasurements(
  samplingPointNotation: string,
  determinandNotations?: string[],
  startDate?: string,
): Promise<DataSourceResult<WaterQualityMeasurement[]>> {
  const since = startDate ?? new Date(Date.now() - 365 * 86_400_000).toISOString().split("T")[0];
  const params = new URLSearchParams({
    "sampling-point": samplingPointNotation,
    startdate: since,
    _limit: "1000",
  });
  if (determinandNotations && determinandNotations.length > 0) {
    params.set("determinand", determinandNotations.join(","));
  }

  const url = `${BASE}/data/measurement?${params}`;
  const resp = await govFetch(url);
  if (!resp.ok) throw new Error(`EA Water Quality API ${resp.status}: ${url}`);

  const json = (await resp.json()) as { items: Array<Record<string, unknown>> };
  const measurements: WaterQualityMeasurement[] = (json.items ?? []).map((raw) => ({
    samplingPoint: String(raw["sample.samplingPoint.notation"] ?? raw.samplingPoint ?? ""),
    samplingPointLabel: raw["sample.samplingPoint.label"] as string | undefined,
    sample: String(raw["@id"] ?? ""),
    sampleDateTime: String(raw["sample.sampleDateTime"] ?? raw.sampleDateTime ?? ""),
    determinand: String(raw["determinand.notation"] ?? raw.determinand ?? ""),
    determinandLabel: raw["determinand.label"] as string | undefined,
    result: Number(raw.result ?? 0),
    unit: String(raw["determinand.unit.label"] ?? raw.unit ?? ""),
    isComplianceSample: raw.isComplianceSample as boolean | undefined,
  }));

  return {
    data: measurements,
    meta: {
      ...OGL_V3,
      source: "EA Water Quality Archive API",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/**
 * Common EA water quality determinand codes for ESRS E3 reporting.
 * These are the most frequently used in discharge consent conditions.
 */
export const DETERMINAND_CODES = {
  BOD5: "0007",        // Biochemical Oxygen Demand (5 days)
  COD: "0116",         // Chemical Oxygen Demand
  SUSPENDED_SOLIDS: "0135", // Total Suspended Solids
  AMMONIA: "0111",     // Ammoniacal Nitrogen
  pH: "0077",          // pH
  DISSOLVED_OXYGEN: "0009", // Dissolved Oxygen (% saturation)
  PHOSPHORUS_TOTAL: "0180", // Phosphorus (Total)
  NITRATE: "0092",     // Nitrate as NO3
  ECOLI: "0232",       // E. coli
  ENTEROCOCCI: "0233", // Enterococci
} as const;

/** Get the catalogue of available determinands */
export async function getDeterminands(): Promise<DataSourceResult<WaterQualityDeterminand[]>> {
  const url = `${BASE}/data/determinand?_limit=500`;
  const resp = await govFetch(url);
  if (!resp.ok) throw new Error(`EA Water Quality API ${resp.status}: ${url}`);
  const json = (await resp.json()) as { items: WaterQualityDeterminand[] };
  return {
    data: json.items ?? [],
    meta: {
      ...OGL_V3,
      source: "EA Water Quality Archive API — Determinands Catalogue",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}
