/**
 * UK EPC (Energy Performance Certificate) API client.
 *
 * Base: https://epc.opendatacommunities.org/api/v1
 * Docs: https://epc.opendatacommunities.org/docs/api
 * Auth: free API key (email signup at epc.opendatacommunities.org)
 * Coverage: England + Wales domestic and non-domestic buildings.
 * Licence: Open Government Licence v3.0
 *
 * Set EPC_API_KEY env var. Without it, calls return null (graceful no-op).
 */

import { DataSourceError } from "./types";

const BASE = "https://epc.opendatacommunities.org/api/v1";
const TIMEOUT_MS = 10_000;

export interface EpcRecord {
  /** EPC certificate reference number */
  lmkKey: string;
  address: string;
  postcode: string;
  /** A–G rating */
  currentEnergyRating: string;
  /** SAP (Standard Assessment Procedure) score 1–100+ */
  currentEnergyEfficiency: number;
  /** Building type: Office, Industrial, Retail, etc. */
  propertyType: string;
  /** Main heating fuel type */
  mainFuelType: string | null;
  /** Gross internal floor area m2 */
  totalFloorArea: number | null;
  /** ISO date string */
  lodgementDate: string;
  /** Inspection date */
  inspectionDate: string;
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildHeaders(): HeadersInit | null {
  const apiKey = process.env.EPC_API_KEY;
  if (!apiKey) return null;
  // API uses HTTP Basic auth: username=email, password=api-key
  // The key itself is the password; username is the registered email.
  // Alternatively, token can be passed as Bearer.
  const email = process.env.EPC_API_EMAIL ?? "api@metricora.co.uk";
  const token = Buffer.from(`${email}:${apiKey}`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    Accept: "application/json",
  };
}

/**
 * Look up non-domestic EPC records by UK postcode.
 * Returns the most recent certificate for the postcode, or null if not found.
 */
export async function lookupEpcByPostcode(postcode: string): Promise<EpcRecord | null> {
  const headers = buildHeaders();
  if (!headers) return null; // EPC_API_KEY not configured

  const clean = postcode.replace(/\s+/g, "").toUpperCase();
  const url = `${BASE}/non-domestic/search?postcode=${encodeURIComponent(clean)}&size=1`;

  try {
    const res = await fetchWithTimeout(url, { headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new DataSourceError("epc", res.status, await res.text().catch(() => ""));

    const data = (await res.json()) as {
      rows: Array<Record<string, string | number | null>>;
    };

    const row = data.rows?.[0];
    if (!row) return null;

    return {
      lmkKey: String(row["lmk-key"] ?? ""),
      address: String(row["address"] ?? ""),
      postcode: String(row["postcode"] ?? postcode),
      currentEnergyRating: String(row["current-energy-rating"] ?? ""),
      currentEnergyEfficiency: Number(row["current-energy-efficiency"] ?? 0),
      propertyType: String(row["property-type"] ?? ""),
      mainFuelType: row["main-fuel"] != null ? String(row["main-fuel"]) : null,
      totalFloorArea: row["total-floor-area"] != null ? Number(row["total-floor-area"]) : null,
      lodgementDate: String(row["lodgement-date"] ?? ""),
      inspectionDate: String(row["inspection-date"] ?? row["lodgement-date"] ?? ""),
    };
  } catch (err) {
    if (err instanceof DataSourceError) throw err;
    throw new DataSourceError("epc", 0, String(err));
  }
}

/**
 * Look up by UPRN (Unique Property Reference Number) — more precise than postcode.
 */
export async function lookupEpcByUprn(uprn: string): Promise<EpcRecord | null> {
  const headers = buildHeaders();
  if (!headers) return null;

  const url = `${BASE}/non-domestic/search?uprn=${encodeURIComponent(uprn)}&size=1`;
  const res = await fetchWithTimeout(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new DataSourceError("epc", res.status, await res.text().catch(() => ""));

  const data = (await res.json()) as { rows: Array<Record<string, string | number | null>> };
  const row = data.rows?.[0];
  if (!row) return null;

  return {
    lmkKey: String(row["lmk-key"] ?? ""),
    address: String(row["address"] ?? ""),
    postcode: String(row["postcode"] ?? ""),
    currentEnergyRating: String(row["current-energy-rating"] ?? ""),
    currentEnergyEfficiency: Number(row["current-energy-efficiency"] ?? 0),
    propertyType: String(row["property-type"] ?? ""),
    mainFuelType: row["main-fuel"] != null ? String(row["main-fuel"]) : null,
    totalFloorArea: row["total-floor-area"] != null ? Number(row["total-floor-area"]) : null,
    lodgementDate: String(row["lodgement-date"] ?? ""),
    inspectionDate: String(row["inspection-date"] ?? row["lodgement-date"] ?? ""),
  };
}
