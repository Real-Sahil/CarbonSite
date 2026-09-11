/**
 * EA Real-Time Flood Monitoring API client.
 *
 * Base: https://environment.data.gov.uk/flood-monitoring/
 * Docs: https://environment.data.gov.uk/flood-monitoring/doc/reference
 * Licence: Open Government Licence v3.0
 * Auth: None
 *
 * Used for ESRS E1 physical climate risk assessment on facility locations.
 * Identifies flood risk zone and active flood alerts near a site.
 */

import { DataSourceResult, OGL_V3, govFetch } from "./types";

const BASE = "https://environment.data.gov.uk/flood-monitoring";

/** A flood-warning area returned by the EA API */
export interface FloodWarningArea {
  notation: string;
  label: string;
  description: string;
  floodWatchArea: string;
  /** URI of the associated catchment */
  riverOrSea: string;
}

/** An active flood warning or alert */
export interface FloodAlert {
  floodAreaID: string;
  description: string;
  /** "Flood Alert" | "Flood Warning" | "Severe Flood Warning" | "Warning no Longer in Force" */
  severity: string;
  severityLevel: number; // 1=severe, 2=warning, 3=alert, 4=no-longer-in-force
  message: string;
  timeRaised: string;
  timeSeverityChanged: string;
}

/** Summary of flood risk at a coordinate */
export interface FloodRiskSummary {
  lat: number;
  lng: number;
  /** Flood warning areas that contain this point */
  warningAreas: FloodWarningArea[];
  /** Active alerts for those warning areas */
  activeAlerts: FloodAlert[];
  /** Highest severity level active (1=severe … 4=none/clear). null if no data. */
  maxSeverityLevel: number | null;
}

/**
 * Get flood warning areas that intersect a bounding box around a lat/lng point.
 * Uses a ~500 m radius bounding box to identify nearby risk areas.
 */
export async function getFloodRiskAtPoint(
  lat: number,
  lng: number,
): Promise<DataSourceResult<FloodRiskSummary>> {
  // 0.005° ≈ 500 m at UK latitudes
  const delta = 0.005;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const url = `${BASE}/id/floodAreas?lat=${lat}&long=${lng}&dist=1`;

  const resp = await govFetch(url);
  if (!resp.ok) {
    throw new Error(`EA Flood Monitoring API ${resp.status}: ${url}`);
  }
  const json = (await resp.json()) as { items: FloodWarningArea[] };
  const warningAreas: FloodWarningArea[] = json.items ?? [];

  // Fetch active warnings for those areas
  const activeAlerts: FloodAlert[] = [];
  if (warningAreas.length > 0) {
    const alertsUrl = `${BASE}/id/floods?min-severity=3`;
    const alertResp = await govFetch(alertsUrl);
    if (alertResp.ok) {
      const alertJson = (await alertResp.json()) as { items: FloodAlert[] };
      const areaIds = new Set(warningAreas.map((a) => a.notation));
      for (const alert of alertJson.items ?? []) {
        if (areaIds.has(alert.floodAreaID)) activeAlerts.push(alert);
      }
    }
  }

  const maxSeverityLevel =
    activeAlerts.length > 0
      ? Math.min(...activeAlerts.map((a) => a.severityLevel))
      : null;

  return {
    data: { lat, lng, warningAreas, activeAlerts, maxSeverityLevel },
    meta: {
      ...OGL_V3,
      source: "EA Real-Time Flood Monitoring API",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/** Look up monitoring stations within `distKm` km of a point */
export interface MonitoringStation {
  stationReference: string;
  label: string;
  catchmentName?: string;
  lat: number;
  long: number;
  measures?: string[];
}

export async function getNearbyStations(
  lat: number,
  lng: number,
  distKm = 5,
): Promise<DataSourceResult<MonitoringStation[]>> {
  const url = `${BASE}/id/stations?lat=${lat}&long=${lng}&dist=${distKm}`;
  const resp = await govFetch(url);
  if (!resp.ok) throw new Error(`EA Flood Monitoring API ${resp.status}: ${url}`);
  const json = (await resp.json()) as { items: MonitoringStation[] };
  return {
    data: json.items ?? [],
    meta: {
      ...OGL_V3,
      source: "EA Real-Time Flood Monitoring API",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/** Latest readings for a single station */
export interface StationReading {
  dateTime: string;
  measure: string;
  value: number;
}

export async function getStationReadings(
  stationRef: string,
  since?: string,
): Promise<DataSourceResult<StationReading[]>> {
  const params = new URLSearchParams({ _limit: "96" });
  if (since) params.set("since", since);
  const url = `${BASE}/id/stations/${stationRef}/readings?${params}`;
  const resp = await govFetch(url);
  if (!resp.ok) throw new Error(`EA Flood Monitoring API ${resp.status}: ${url}`);
  const json = (await resp.json()) as { items: StationReading[] };
  return {
    data: json.items ?? [],
    meta: {
      ...OGL_V3,
      source: "EA Real-Time Flood Monitoring API",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}
