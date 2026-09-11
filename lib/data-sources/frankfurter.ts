/**
 * Frankfurter.app exchange rate client.
 *
 * Base: https://api.frankfurter.app
 * Source: European Central Bank (ECB) reference rates, updated daily ~16:00 CET.
 * Licence: free, no auth, no API key.
 *
 * Used to convert spend-based Scope 3 activity amounts to GBP before
 * applying DEFRA EEIO spend-intensity factors (which are expressed per GBP).
 * Replaces the hardcoded approximate rates in lib/calculation/units.ts.
 */

import { DataSourceError } from "./types";

const BASE = "https://api.frankfurter.app";
const TIMEOUT_MS = 6_000;

export interface ExchangeRates {
  /** Base currency (always "GBP" for our calls) */
  base: string;
  date: string; // YYYY-MM-DD
  /** currency code → rate (how many units of base per 1 foreign unit) */
  rates: Record<string, number>;
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
 * Fetch latest ECB exchange rates with GBP as base.
 * Returns a map of currency code → GBP value per 1 unit of that currency.
 */
export async function getLatestRatesGbp(): Promise<ExchangeRates> {
  const url = `${BASE}/latest?base=GBP`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("frankfurter", res.status, await res.text().catch(() => ""));
  const data = (await res.json()) as { base: string; date: string; rates: Record<string, number> };
  if (!data.rates || typeof data.rates !== "object") {
    throw new DataSourceError("frankfurter", 0, "unexpected response shape");
  }
  return data as ExchangeRates;
}

/**
 * Convert an amount in `fromCurrency` to GBP using live ECB rates.
 * Falls back gracefully to the approximate rate map if the API is unreachable.
 */
export async function convertToGbp(
  amount: number,
  fromCurrency: string,
): Promise<{ gbpAmount: number; rate: number; source: "live" | "fallback" }> {
  if (fromCurrency === "GBP") return { gbpAmount: amount, rate: 1, source: "live" };

  // Hardcoded fallback (approximate, updated Q3 2025)
  const FALLBACK: Record<string, number> = {
    USD: 0.787, EUR: 0.855, AUD: 0.507, CAD: 0.581, SGD: 0.582,
    HKD: 0.101, NZD: 0.460, JPY: 0.00515, CNY: 0.108, INR: 0.00941,
    BRL: 0.138, MXN: 0.039, ZAR: 0.042, CHF: 0.896, SEK: 0.074,
    NOK: 0.073, DKK: 0.115, PLN: 0.194, CZK: 0.034, HUF: 0.0022,
  };

  try {
    const rates = await getLatestRatesGbp();
    // rates.rates gives "how many GBP per 1 EUR" etc.
    const rateGbpPerForeign = rates.rates[fromCurrency];
    if (!rateGbpPerForeign) throw new DataSourceError("frankfurter", 0, `No rate for ${fromCurrency}`);
    return { gbpAmount: amount * rateGbpPerForeign, rate: rateGbpPerForeign, source: "live" };
  } catch {
    const fallbackRate = FALLBACK[fromCurrency];
    if (!fallbackRate) throw new DataSourceError("frankfurter", 0, `No fallback rate for ${fromCurrency}`);
    return { gbpAmount: amount * fallbackRate, rate: fallbackRate, source: "fallback" };
  }
}

/**
 * Fetch historical exchange rate for a specific date.
 * Useful for Scope 3 calculations where the activity date matters.
 */
export async function getHistoricalRateGbp(
  fromCurrency: string,
  date: string, // YYYY-MM-DD
): Promise<number> {
  if (fromCurrency === "GBP") return 1;
  const url = `${BASE}/${date}?base=GBP&symbols=${fromCurrency}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("frankfurter", res.status, await res.text().catch(() => ""));
  const data = (await res.json()) as { rates: Record<string, number> };
  const rate = data.rates?.[fromCurrency];
  if (typeof rate !== "number") throw new DataSourceError("frankfurter", 0, `no rate for ${fromCurrency} on ${date}`);
  return rate;
}
