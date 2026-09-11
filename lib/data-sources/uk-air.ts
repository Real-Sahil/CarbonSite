/**
 * UK-AIR AURN (Automatic Urban and Rural Network) API client.
 *
 * Base: https://uk-air.defra.gov.uk/
 * SOS: https://uk-air.defra.gov.uk/sos-kuk-service
 * Licence: Open Government Licence v3.0
 * Auth: None
 *
 * Provides ambient air quality measurements (NO2, PM2.5, PM10, O3, SO2)
 * from the AURN network of ~170 monitoring stations across the UK. Used for:
 *   - ESRS E2 air quality disclosure (local ambient concentrations near sites)
 *   - Contextualising Scope 1 combustion emission plumes against background levels
 *   - Compliance benchmarking against WHO/EU ambient air quality standards
 *
 * The SOS 2.0 interface accepts KVP (key-value pair) requests and returns JSON
 * via the f=application/json or responseFormat=application/json parameter.
 * Alternatively, the datashare CSV download API is used for bulk annual data.
 */

import { DataSourceResult, OGL_V3, govFetch } from "./types";

const SOS_BASE = "https://uk-air.defra.gov.uk/sos-kuk-service";
const SITES_API = "https://uk-air.defra.gov.uk/data/API";

/** An AURN monitoring station */
export interface AurnStation {
  /** UK-AIR station identifier, e.g. "ACTH" */
  stationCode: string;
  stationName: string;
  lat: number;
  lng: number;
  /** Station environment type: "Urban Background", "Rural Background", "Roadside", etc. */
  environment?: string;
  /** Whether station is currently active */
  active?: boolean;
  /** Pollutants measured at this station */
  measuredPollutants?: string[];
}

/** An air quality measurement reading */
export interface AirQualityReading {
  stationCode: string;
  stationName?: string;
  /** Pollutant short code: "NO2", "PM10", "PM2.5", "O3", "SO2", "CO" */
  pollutant: string;
  /** ISO 8601 observation datetime */
  observedAt: string;
  /** Measured concentration value */
  value: number;
  /** Unit of measurement, typically "µg/m³" or "mg/m³" */
  unit: string;
  /** Quality flag — 1=valid, 2=suspect, 3=missing */
  qualityFlag?: number;
}

/** WHO 2021 and UK 2023 annual mean ambient air quality guideline values in µg/m³ */
export const AMBIENT_AQ_GUIDELINES = {
  NO2: { who: 10, ukLimit: 40, unit: "µg/m³", averaging: "annual mean" },
  PM2_5: { who: 5, ukLimit: 20, unit: "µg/m³", averaging: "annual mean" },
  PM10: { who: 15, ukLimit: 40, unit: "µg/m³", averaging: "annual mean" },
  O3: { who: 60, ukLimit: 100, unit: "µg/m³", averaging: "peak season daily 8hr mean" },
  SO2: { who: 40, ukLimit: 266, unit: "µg/m³", averaging: "15-minute mean" },
} as const;

/**
 * Find AURN monitoring stations within `radiusKm` km of a point.
 * Uses the UK-AIR sites metadata API (returns JSON directly).
 */
export async function getNearbyAurnStations(
  lat: number,
  lng: number,
  radiusKm = 20,
): Promise<DataSourceResult<AurnStation[]>> {
  // The SOS GetCapabilities / GetFeatureOfInterest can list all stations
  // We use the site-list endpoint and filter client-side by bounding box
  const params = new URLSearchParams({
    service: "SOS",
    version: "2.0.0",
    request: "GetFeatureOfInterest",
    responseFormat: "application/json",
  });
  const url = `${SOS_BASE}?${params}`;
  const resp = await govFetch(url, 20_000);
  if (!resp.ok) throw new Error(`UK-AIR SOS ${resp.status}: ${url}`);

  const json = (await resp.json()) as {
    featureCollection?: {
      features?: Array<{
        properties?: Record<string, unknown>;
        geometry?: { coordinates?: [number, number] };
      }>;
    };
  };

  const allFeatures = json.featureCollection?.features ?? [];
  // Simple bounding-box pre-filter (1 degree ≈ 111 km)
  const degreeDelta = radiusKm / 111;
  const stations: AurnStation[] = [];

  for (const f of allFeatures) {
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    const [fLng, fLat] = coords;
    if (
      Math.abs(fLat - lat) > degreeDelta ||
      Math.abs(fLng - lng) > degreeDelta
    )
      continue;

    const props = f.properties ?? {};
    stations.push({
      stationCode: String(props.id ?? props.code ?? ""),
      stationName: String(props.name ?? props.label ?? ""),
      lat: fLat,
      lng: fLng,
      environment: props.environment as string | undefined,
      active: props.active !== false,
    });
  }

  return {
    data: stations,
    meta: {
      ...OGL_V3,
      source: "UK-AIR AURN — SOS GetFeatureOfInterest",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/**
 * Get recent air quality observations for a station and one or more pollutants.
 *
 * Uses OGC SOS 2.0 GetObservation with temporalFilter.
 * @param stationCode  UK-AIR station code, e.g. "ACTH"
 * @param pollutants   Pollutant codes, e.g. ["NO2", "PM10"]. Omit for all.
 * @param hoursBack    How many hours of data to fetch (default: 24h)
 */
export async function getStationObservations(
  stationCode: string,
  pollutants?: string[],
  hoursBack = 24,
): Promise<DataSourceResult<AirQualityReading[]>> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - hoursBack * 3_600_000);

  const params = new URLSearchParams({
    service: "SOS",
    version: "2.0.0",
    request: "GetObservation",
    featureOfInterest: stationCode,
    temporalFilter: `om:phenomenonTime,${startTime.toISOString()}/${endTime.toISOString()}`,
    responseFormat: "application/json",
  });
  if (pollutants && pollutants.length > 0) {
    params.set("observedProperty", pollutants.join(","));
  }

  const url = `${SOS_BASE}?${params}`;
  const resp = await govFetch(url, 20_000);
  if (!resp.ok) throw new Error(`UK-AIR SOS ${resp.status}: ${url}`);

  const json = (await resp.json()) as {
    observations?: Array<{
      phenomenonTime?: string;
      result?: { value?: number; uom?: string; quality?: number };
      observedProperty?: string;
      featureOfInterest?: string | { name?: string };
    }>;
  };

  const readings: AirQualityReading[] = (json.observations ?? []).map((obs) => {
    const pollutantRaw = String(obs.observedProperty ?? "");
    const pollutantLabel = pollutantRaw.split("/").pop()?.toUpperCase() ?? pollutantRaw;
    const foi = obs.featureOfInterest;
    return {
      stationCode,
      stationName: typeof foi === "object" ? foi?.name : undefined,
      pollutant: pollutantLabel,
      observedAt: obs.phenomenonTime ?? endTime.toISOString(),
      value: obs.result?.value ?? 0,
      unit: obs.result?.uom ?? "µg/m³",
      qualityFlag: obs.result?.quality,
    };
  });

  return {
    data: readings,
    meta: {
      ...OGL_V3,
      source: "UK-AIR AURN — SOS GetObservation",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/**
 * Get annual mean concentrations for a station (last full calendar year).
 * Uses the UK-AIR data download CSV endpoint directly.
 * Returns only valid (quality flag = 1) hourly averages, aggregated to annual mean.
 */
export async function getAnnualMeanConcentrations(
  stationCode: string,
  year?: number,
): Promise<DataSourceResult<Record<string, number>>> {
  const targetYear = year ?? new Date().getFullYear() - 1;
  // UK-AIR data download endpoint — returns CSV for a given site and year
  const url = `https://uk-air.defra.gov.uk/data/API/apiversion/sites/${encodeURIComponent(stationCode)}/data?year=${targetYear}`;
  const resp = await govFetch(url, 30_000);

  if (resp.status === 404) {
    return {
      data: {},
      meta: {
        ...OGL_V3,
        source: "UK-AIR AURN Data Download",
        retrievedAt: new Date().toISOString(),
        endpoint: url,
      },
    };
  }
  if (!resp.ok) throw new Error(`UK-AIR Data Download ${resp.status}: ${url}`);

  const json = (await resp.json()) as { data?: Array<Record<string, unknown>> };
  const rows = json.data ?? [];

  // Aggregate to annual mean per pollutant
  const totals: Record<string, { sum: number; count: number }> = {};
  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      if (key === "date" || key === "time" || typeof val !== "number") continue;
      if (!totals[key]) totals[key] = { sum: 0, count: 0 };
      totals[key].sum += val;
      totals[key].count += 1;
    }
  }

  const annualMeans: Record<string, number> = {};
  for (const [pollutant, { sum, count }] of Object.entries(totals)) {
    if (count > 0) annualMeans[pollutant] = sum / count;
  }

  return {
    data: annualMeans,
    meta: {
      ...OGL_V3,
      source: `UK-AIR AURN Annual Data — ${targetYear}`,
      version: String(targetYear),
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}
