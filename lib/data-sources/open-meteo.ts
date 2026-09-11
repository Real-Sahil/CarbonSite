/**
 * Open-Meteo weather API client.
 *
 * Base: https://api.open-meteo.com/v1
 * Docs: https://open-meteo.com/en/docs
 * Licence: free, no auth, no API key required.
 * Coverage: global, ERA5 reanalysis for historical, ECMWF/GFS for forecast.
 *
 * Used for:
 *   1. Degree-day normalisation of energy baselines (heating/cooling)
 *   2. Climate risk scoring for facility-level environmental disclosures
 *   3. Future: ISO 50001 energy intensity normalisation
 */

import { DataSourceError } from "./types";

const BASE = "https://api.open-meteo.com/v1";
const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1";
const TIMEOUT_MS = 12_000;

export interface DailyWeather {
  date: string; // YYYY-MM-DD
  tempMaxC: number;
  tempMinC: number;
  tempMeanC: number;
  precipitation_mm: number;
}

export interface DegreeDaySummary {
  /** Heating degree days (base 15.5°C, UK standard) */
  hdd: number;
  /** Cooling degree days (base 22°C) */
  cdd: number;
  /** Period covered */
  fromDate: string;
  toDate: string;
  dailyRecords: number;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch historical daily temperature data for a lat/lng and date range.
 */
export async function getHistoricalDaily(
  lat: number,
  lng: number,
  startDate: string, // YYYY-MM-DD
  endDate: string,   // YYYY-MM-DD
): Promise<DailyWeather[]> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    start_date: startDate,
    end_date: endDate,
    daily: "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum",
    timezone: "auto",
  });

  const url = `${ARCHIVE_BASE}/archive?${params}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("open-meteo", res.status, await res.text().catch(() => ""));

  const data = (await res.json()) as {
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      temperature_2m_mean: number[];
      precipitation_sum: number[];
    };
  };

  if (!data.daily?.time) throw new DataSourceError("open-meteo", 0, "unexpected response shape");

  return data.daily.time.map((date, i) => ({
    date,
    tempMaxC: data.daily.temperature_2m_max[i] ?? 0,
    tempMinC: data.daily.temperature_2m_min[i] ?? 0,
    tempMeanC: data.daily.temperature_2m_mean[i] ?? 0,
    precipitation_mm: data.daily.precipitation_sum[i] ?? 0,
  }));
}

/**
 * Compute heating and cooling degree days for a facility over a reporting period.
 * UK standard: HDD base 15.5°C, CDD base 22°C.
 */
export async function computeDegreeDays(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
  hddBase = 15.5,
  cddBase = 22.0,
): Promise<DegreeDaySummary> {
  const daily = await getHistoricalDaily(lat, lng, startDate, endDate);

  let hdd = 0;
  let cdd = 0;
  for (const day of daily) {
    hdd += Math.max(0, hddBase - day.tempMeanC);
    cdd += Math.max(0, day.tempMeanC - cddBase);
  }

  return {
    hdd: Math.round(hdd * 10) / 10,
    cdd: Math.round(cdd * 10) / 10,
    fromDate: startDate,
    toDate: endDate,
    dailyRecords: daily.length,
  };
}

/**
 * Get current 7-day weather forecast for a facility.
 * Used for operational planning (optimal load-shifting to low-carbon grid hours).
 */
export async function getForecast(lat: number, lng: number): Promise<DailyWeather[]> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    daily: "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum",
    forecast_days: "7",
    timezone: "auto",
  });

  const url = `${BASE}/forecast?${params}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("open-meteo", res.status, await res.text().catch(() => ""));

  const data = (await res.json()) as {
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      temperature_2m_mean: number[];
      precipitation_sum: number[];
    };
  };

  return (data.daily?.time ?? []).map((date, i) => ({
    date,
    tempMaxC: data.daily.temperature_2m_max[i] ?? 0,
    tempMinC: data.daily.temperature_2m_min[i] ?? 0,
    tempMeanC: data.daily.temperature_2m_mean[i] ?? 0,
    precipitation_mm: data.daily.precipitation_sum[i] ?? 0,
  }));
}
