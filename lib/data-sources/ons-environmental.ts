/**
 * ONS Environmental Accounts Beta API client.
 *
 * Base: https://api.beta.ons.gov.uk/v1/
 * Docs: https://developer.ons.gov.uk/
 * Licence: Open Government Licence v3.0
 * Auth: None (public beta API)
 *
 * Provides UK Environmental Accounts data — physical supply and use tables,
 * atmospheric emissions accounts, water accounts, and material flow accounts
 * published as part of the UK System of Environmental-Economic Accounting
 * (UK SEEA). Used for:
 *   - ESRS E1 national-sector GHG intensity benchmarking
 *   - ESRS E3 water intensity benchmarks by sector
 *   - Comparators for CSRD double-materiality thresholds
 */

import { DataSourceResult, OGL_V3, govFetch } from "./types";

const ONS_BASE = "https://api.beta.ons.gov.uk/v1";

export interface OnsDataset {
  id: string;
  title: string;
  description?: string;
  releaseDate?: string;
  nextRelease?: string;
  /** Latest available edition identifier */
  latestEdition?: string;
}

export interface OnsObservation {
  /** Dimension values that identify this cell, e.g. { time: "2023", industry: "C" } */
  dimensions: Record<string, string>;
  value: number | null;
  unit?: string;
}

/**
 * List available environmental-accounts datasets from ONS.
 * Filters to datasets whose IDs start with known env-accounts prefixes.
 */
export async function listEnvironmentalDatasets(): Promise<DataSourceResult<OnsDataset[]>> {
  const url = `${ONS_BASE}/datasets`;
  const resp = await govFetch(url, 15_000);
  if (!resp.ok) throw new Error(`ONS API ${resp.status}: ${url}`);

  const json = (await resp.json()) as {
    items?: Array<{
      id?: string;
      title?: string;
      description?: string;
      release_date?: string;
      next_release?: string;
      links?: { latest_version?: { href?: string } };
    }>;
  };

  const ENV_PREFIXES = ["env", "atmospheric", "water", "material", "ghg", "natural"];
  const items: OnsDataset[] = (json.items ?? [])
    .filter((d) => {
      const id = (d.id ?? "").toLowerCase();
      const title = (d.title ?? "").toLowerCase();
      return (
        ENV_PREFIXES.some((p) => id.startsWith(p) || title.includes(p)) ||
        title.includes("environment") ||
        title.includes("emission")
      );
    })
    .map((d) => ({
      id: String(d.id ?? ""),
      title: String(d.title ?? ""),
      description: d.description as string | undefined,
      releaseDate: d.release_date as string | undefined,
      nextRelease: d.next_release as string | undefined,
    }));

  return {
    data: items,
    meta: {
      ...OGL_V3,
      source: "ONS Beta API — Datasets Catalogue",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/**
 * Fetch observations from an ONS dataset.
 * Supports filter parameters to narrow time, geography, and classification.
 *
 * @param datasetId  ONS dataset ID, e.g. "atmospheric-emissions-gwp100-ar5-gases-tonnes"
 * @param filters    Key/value dimension filters, e.g. { time: "2022", geography: "K02000001" }
 */
export async function getDatasetObservations(
  datasetId: string,
  filters: Record<string, string> = {},
): Promise<DataSourceResult<OnsObservation[]>> {
  // Resolve latest edition and version
  const datasetUrl = `${ONS_BASE}/datasets/${encodeURIComponent(datasetId)}`;
  const datasetResp = await govFetch(datasetUrl, 10_000);
  if (!datasetResp.ok) throw new Error(`ONS API ${datasetResp.status}: ${datasetUrl}`);

  const datasetJson = (await datasetResp.json()) as {
    links?: { latest_version?: { href?: string } };
    id?: string;
  };

  const latestVersionUrl = datasetJson.links?.latest_version?.href;
  if (!latestVersionUrl) {
    return {
      data: [],
      meta: {
        ...OGL_V3,
        source: `ONS — ${datasetId}`,
        retrievedAt: new Date().toISOString(),
        endpoint: datasetUrl,
      },
    };
  }

  // Build observations query with dimension filters
  const params = new URLSearchParams();
  for (const [dim, val] of Object.entries(filters)) {
    params.set(dim, val);
  }
  const obsUrl = `${latestVersionUrl}/observations${params.size > 0 ? `?${params}` : ""}`;
  const obsResp = await govFetch(obsUrl, 20_000);
  if (!obsResp.ok) throw new Error(`ONS API ${obsResp.status}: ${obsUrl}`);

  const obsJson = (await obsResp.json()) as {
    observations?: Array<{
      dimensions?: Record<string, { option?: string; option_id?: string }>;
      observation?: string | null;
      metadata?: { unit?: string };
    }>;
    unit_of_measure?: string;
  };

  const observations: OnsObservation[] = (obsJson.observations ?? []).map((o) => {
    const dims: Record<string, string> = {};
    for (const [key, val] of Object.entries(o.dimensions ?? {})) {
      dims[key] = String(val.option ?? val.option_id ?? "");
    }
    return {
      dimensions: dims,
      value: o.observation != null && o.observation !== "" ? Number(o.observation) : null,
      unit: o.metadata?.unit ?? obsJson.unit_of_measure,
    };
  });

  return {
    data: observations,
    meta: {
      ...OGL_V3,
      source: `ONS — ${datasetId}`,
      retrievedAt: new Date().toISOString(),
      endpoint: obsUrl,
    },
  };
}

/**
 * Well-known ONS environmental dataset IDs for ESRS benchmarking.
 * These are the most stable dataset identifiers as of the 2024 release.
 */
export const ONS_ENV_DATASETS = {
  /** Atmospheric emissions by industry — GHG (GWP100 AR5), ktCO2e */
  ATMOSPHERIC_GHG: "atmospheric-emissions-gwp100-ar5-gases-tonnes",
  /** Air emissions by industry — NOx, SO2, PM2.5, PM10 */
  AIR_EMISSIONS: "atmospheric-emissions-acidifying-eutrophying-gases-byindustry",
  /** Water abstractions by industry */
  WATER_ABSTRACTIONS: "water-abstractions-industry",
  /** UK environmental accounts — overview time series */
  ENV_ACCOUNTS_OVERVIEW: "environmental-accounts",
} as const;
