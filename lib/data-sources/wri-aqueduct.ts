/**
 * WRI Aqueduct 4.0 water risk atlas API client.
 *
 * Base: https://api.wri.org/v1/aqueduct/
 * Docs: https://www.wri.org/data/aqueduct-water-risk-atlas
 * Licence: CC BY 4.0 (data); free API access, no key required.
 *
 * Returns water stress and related risk scores for a lat/lng point.
 * Used to auto-populate Facility.waterStressLevel, waterStressSource,
 * and waterStressAssessedAt rather than requiring manual admin entry.
 *
 * Score scale:  0–1 = Low, 1–2 = Low–Medium, 2–3 = Medium–High,
 *               3–4 = High, 4–5 = Extremely High.
 */

import { DataSourceError } from "./types";

const BASE = "https://api.wri.org/v1/aqueduct";
const TIMEOUT_MS = 10_000;

/** Maps to Prisma WaterStressLevel enum */
export type WaterStressLevel = "low" | "medium_high" | "high" | "extremely_high" | "unknown";

export interface AqueductWaterRisk {
  /** Overall water stress score 0–5 */
  bws: number | null;
  /** Interannual variability */
  iav: number | null;
  /** Seasonal variability */
  sev: number | null;
  /** Groundwater depletion */
  gwd: number | null;
  /** Riverine flood risk */
  rfr: number | null;
  /** Drought risk */
  drr: number | null;
  /** WaterStressLevel enum for Facility model */
  level: WaterStressLevel;
  /** Human-readable label */
  label: string;
  source: "WRI Aqueduct 4.0";
}

async function fetchWithTimeout(url: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }
}

function scoreToLevel(score: number | null): WaterStressLevel {
  if (score === null) return "unknown";
  if (score < 1) return "low";
  if (score < 3) return "medium_high";
  if (score < 4) return "high";
  return "extremely_high";
}

function scoreToLabel(score: number | null): string {
  if (score === null) return "Unknown";
  if (score < 1) return "Low";
  if (score < 2) return "Low to Medium";
  if (score < 3) return "Medium to High";
  if (score < 4) return "High";
  return "Extremely High";
}

/**
 * Returns water risk indicators for the watershed containing the given point.
 * Returns null gracefully when the API is unreachable so callers can fall back
 * to manual entry without breaking.
 */
export async function getWaterRiskAtPoint(
  lat: number,
  lng: number,
): Promise<AqueductWaterRisk | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/water-risk/point/`, {
      geogunit_unique_name: null,
      geostore_id: null,
      geometry: { type: "Point", coordinates: [lng, lat] },
      indicators: ["bws", "iav", "sev", "gwd", "rfr", "drr"],
      year: "baseline",
      scenario: "optimistic",
    });
    if (!res.ok) throw new DataSourceError("wri-aqueduct", res.status, await res.text().catch(() => ""));
    const json = await res.json() as {
      data?: Array<{
        indicator_name: string;
        score: number | null;
      }>;
    };
    const scores: Record<string, number | null> = {};
    for (const row of json.data ?? []) {
      scores[row.indicator_name] = row.score;
    }
    const bws = scores["bws"] ?? null;
    return {
      bws,
      iav: scores["iav"] ?? null,
      sev: scores["sev"] ?? null,
      gwd: scores["gwd"] ?? null,
      rfr: scores["rfr"] ?? null,
      drr: scores["drr"] ?? null,
      level: scoreToLevel(bws),
      label: scoreToLabel(bws),
      source: "WRI Aqueduct 4.0",
    };
  } catch (err) {
    // Return null instead of throwing — callers log and fall back to manual entry.
    if (err instanceof DataSourceError) return null;
    return null;
  }
}
