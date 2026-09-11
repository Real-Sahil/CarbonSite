/**
 * National Grid ESO Carbon Intensity API client.
 *
 * Base: https://api.carbonintensity.org.uk/
 * Docs: https://carbon-intensity.github.io/api-definitions/
 * Licence: Open Government Licence v3.0
 * No API key required.
 *
 * Returns the real-time and 48-hour forecast grid carbon intensity (gCO2/kWh)
 * by GB region. Used to populate STORAGE_DRIVER=supabase Scope 2 market-based
 * intensity values and to advise on optimal shift-load timing.
 */

import { DataSourceError } from "./types";

const BASE = "https://api.carbonintensity.org.uk";
const TIMEOUT_MS = 8_000;

export interface RegionalIntensity {
  regionId: number;
  shortname: string;
  /** gCO2/kWh */
  intensity: number;
  index: "very low" | "low" | "moderate" | "high" | "very high";
  generationMix: Array<{ fuel: string; perc: number }>;
}

export interface NationalIntensity {
  /** gCO2/kWh actual */
  actual: number | null;
  /** gCO2/kWh forecast */
  forecast: number;
  index: "very low" | "low" | "moderate" | "high" | "very high";
  from: string;
  to: string;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Current national grid intensity. */
export async function getNationalIntensity(): Promise<NationalIntensity> {
  const res = await fetchWithTimeout(`${BASE}/intensity`);
  if (!res.ok) throw new DataSourceError("carbon-intensity", res.status, await res.text().catch(() => ""));
  const json = await res.json() as { data: Array<{ from: string; to: string; intensity: { actual: number | null; forecast: number; index: string } }> };
  const entry = json.data[0];
  if (!entry) throw new DataSourceError("carbon-intensity", 0, "Empty response");
  return {
    actual: entry.intensity.actual,
    forecast: entry.intensity.forecast,
    index: entry.intensity.index as NationalIntensity["index"],
    from: entry.from,
    to: entry.to,
  };
}

/** Current regional intensities across all GB regions. */
export async function getRegionalIntensities(): Promise<RegionalIntensity[]> {
  const res = await fetchWithTimeout(`${BASE}/regional`);
  if (!res.ok) throw new DataSourceError("carbon-intensity", res.status, await res.text().catch(() => ""));
  const json = await res.json() as {
    data: Array<{
      regions: Array<{
        regionid: number;
        shortname: string;
        intensity: { forecast: number; index: string };
        generationmix: Array<{ fuel: string; perc: number }>;
      }>;
    }>;
  };
  const regions = json.data[0]?.regions ?? [];
  return regions.map((r) => ({
    regionId: r.regionid,
    shortname: r.shortname,
    intensity: r.intensity.forecast,
    index: r.intensity.index as RegionalIntensity["index"],
    generationMix: r.generationmix,
  }));
}

/**
 * 48-hour half-hourly forecast for a single postcode district (e.g. "SW1A").
 * Used to advise on optimal electricity-intensive operation timing.
 */
export async function getForecastByPostcode(
  postcodeDistrict: string,
): Promise<Array<{ from: string; to: string; forecast: number; index: string }>> {
  const res = await fetchWithTimeout(
    `${BASE}/regional/postcode/${encodeURIComponent(postcodeDistrict)}`,
  );
  if (!res.ok) throw new DataSourceError("carbon-intensity", res.status, await res.text().catch(() => ""));
  const json = await res.json() as {
    data: Array<{
      data: Array<{ from: string; to: string; intensity: { forecast: number; index: string } }>;
    }>;
  };
  return (json.data[0]?.data ?? []).map((d) => ({
    from: d.from,
    to: d.to,
    forecast: d.intensity.forecast,
    index: d.intensity.index,
  }));
}
