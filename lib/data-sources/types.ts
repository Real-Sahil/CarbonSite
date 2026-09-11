/**
 * Shared types for external data source clients.
 *
 * Every response from a public-sector data source MUST carry provenance
 * metadata so calculations, compliance assessments, and disclosures can be
 * traced back to the exact API call that produced the underlying data.
 */

export interface DataSourceMeta {
  /** Human-readable name, e.g. "EA Real-Time Flood Monitoring API" */
  source: string;
  /** Dataset version or publication year where the API exposes it */
  version?: string;
  /** ISO 8601 timestamp of the API response */
  retrievedAt: string;
  /** SPDX-compatible licence identifier or plain-text name */
  licence: string;
  /** Canonical URL for the licence text */
  licenceUrl: string;
  /** The exact URL that was called */
  endpoint: string;
}

export interface DataSourceResult<T> {
  data: T;
  meta: DataSourceMeta;
}

/** Standard OGL v3 meta — reuse across all EA/DEFRA/NE/ONS/NAEI sources */
export const OGL_V3: Pick<DataSourceMeta, "licence" | "licenceUrl"> = {
  licence: "Open Government Licence v3.0",
  licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
};

/** Fetch with a sensible timeout and user-agent. Never throws on HTTP error —
 *  returns the response so callers can inspect the status code. */
export async function govFetch(url: string, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "MetricOra/1.0 (GHG compliance platform; https://metricora.com)",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
