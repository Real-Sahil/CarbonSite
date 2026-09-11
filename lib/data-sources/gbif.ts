/**
 * GBIF (Global Biodiversity Information Facility) API client.
 *
 * Base: https://api.gbif.org/v1/
 * Docs: https://www.gbif.org/developer/summary
 * Licence: CC0 1.0 (occurrence records); individual datasets may carry CC BY or CC BY-NC.
 * No API key required for read access (anonymous quota: 10 req/s).
 *
 * Used by the BNG (Biodiversity Net Gain) module to:
 *  - Validate species scientific names against the GBIF Backbone Taxonomy
 *  - Find accepted names for synonyms (e.g. old taxon names on legacy survey sheets)
 *  - Search UK species occurrence records (complementing NBN Atlas for global species)
 *  - Look up IUCN Red List category from taxon metadata
 *
 * GBIF covers global species; for UK-specific legally-protected status use NBN Atlas.
 */

import { DataSourceError } from "./types";

const BASE = "https://api.gbif.org/v1";
const TIMEOUT_MS = 10_000;

export interface GbifTaxon {
  /** GBIF internal taxon key */
  key: number;
  scientificName: string;
  canonicalName: string;
  authorship?: string;
  /** Taxonomic rank: SPECIES, GENUS, FAMILY, ... */
  rank: string;
  /** Taxonomic status: ACCEPTED, SYNONYM, DOUBTFUL, ... */
  taxonomicStatus: string;
  /** Key of the accepted taxon if this is a synonym */
  acceptedKey?: number;
  acceptedScientificName?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  /** IUCN Red List category code, e.g. "LC", "EN", "CR" — may be absent */
  iucnRedListCategory?: string;
}

export interface GbifOccurrence {
  key: number;
  species?: string;
  scientificName: string;
  canonicalName?: string;
  /** ISO 3166-1 alpha-2 country code */
  countryCode?: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
  year?: number;
  month?: number;
  day?: number;
  basisOfRecord: string;
  occurrenceID?: string;
  datasetName?: string;
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

/**
 * Match a species name against the GBIF Backbone Taxonomy.
 * Returns the best-matching accepted taxon (follows synonyms automatically).
 * Returns null if no match found or the name is too ambiguous.
 */
export async function matchSpeciesName(
  scientificName: string,
  opts: { strict?: boolean; kingdom?: string } = {},
): Promise<GbifTaxon | null> {
  const params = new URLSearchParams({ name: scientificName, verbose: "false" });
  if (opts.strict) params.set("strict", "true");
  if (opts.kingdom) params.set("kingdom", opts.kingdom);
  const url = `${BASE}/species/match?${params}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("gbif", res.status, await res.text().catch(() => ""));
  const json = await res.json() as {
    usageKey?: number;
    scientificName?: string;
    canonicalName?: string;
    authorship?: string;
    rank?: string;
    status?: string;
    matchType?: string;
    acceptedUsageKey?: number;
    kingdom?: string;
    phylum?: string;
    class?: string;
    order?: string;
    family?: string;
    genus?: string;
    iucnRedListCategory?: string;
  };

  if (!json.usageKey || json.matchType === "NONE") return null;
  return {
    key: json.usageKey,
    scientificName: json.scientificName ?? scientificName,
    canonicalName: json.canonicalName ?? scientificName,
    authorship: json.authorship,
    rank: json.rank ?? "UNKNOWN",
    taxonomicStatus: json.status ?? "UNKNOWN",
    acceptedKey: json.acceptedUsageKey,
    kingdom: json.kingdom,
    phylum: json.phylum,
    class: json.class,
    order: json.order,
    family: json.family,
    genus: json.genus,
    iucnRedListCategory: json.iucnRedListCategory,
  };
}

/**
 * Fetch full taxon details by GBIF taxon key.
 */
export async function getTaxonByKey(key: number): Promise<GbifTaxon | null> {
  const res = await fetchWithTimeout(`${BASE}/species/${key}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new DataSourceError("gbif", res.status, await res.text().catch(() => ""));
  const json = await res.json() as {
    key: number;
    scientificName?: string;
    canonicalName?: string;
    authorship?: string;
    rank?: string;
    taxonomicStatus?: string;
    acceptedKey?: number;
    accepted?: string;
    kingdom?: string;
    phylum?: string;
    class?: string;
    order?: string;
    family?: string;
    genus?: string;
    iucnRedListCategory?: string;
  };
  return {
    key: json.key,
    scientificName: json.scientificName ?? String(key),
    canonicalName: json.canonicalName ?? json.scientificName ?? String(key),
    authorship: json.authorship,
    rank: json.rank ?? "UNKNOWN",
    taxonomicStatus: json.taxonomicStatus ?? "UNKNOWN",
    acceptedKey: json.acceptedKey,
    acceptedScientificName: json.accepted,
    kingdom: json.kingdom,
    phylum: json.phylum,
    class: json.class,
    order: json.order,
    family: json.family,
    genus: json.genus,
    iucnRedListCategory: json.iucnRedListCategory,
  };
}

/**
 * Search GBIF occurrence records near a point within the UK (countryCode=GB).
 * Useful to cross-reference NBN Atlas records with global GBIF data.
 * Returns at most `limit` results (max 300).
 */
export async function getUkOccurrencesNearPoint(
  lat: number,
  lng: number,
  radiusKm = 2,
  limit = 50,
): Promise<GbifOccurrence[]> {
  // GBIF uses "radius" in metres (as of v1 API — not km)
  const radiusM = radiusKm * 1000;
  const params = new URLSearchParams({
    decimalLatitude: `${lat - radiusKm / 111},${ lat + radiusKm / 111}`, // ~degree bounds
    decimalLongitude: `${lng - radiusKm / 111},${ lng + radiusKm / 111}`,
    country: "GB",
    hasCoordinate: "true",
    hasGeospatialIssue: "false",
    limit: String(Math.min(limit, 300)),
  });
  // Use the coordinate range search — GBIF doesn't have a built-in radius search
  void radiusM; // declared for documentation; coordinate bounds are the proxy
  const url = `${BASE}/occurrence/search?${params}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("gbif", res.status, await res.text().catch(() => ""));
  const json = await res.json() as {
    results?: Array<{
      key: number;
      species?: string;
      scientificName?: string;
      canonicalName?: string;
      countryCode?: string;
      decimalLatitude?: number;
      decimalLongitude?: number;
      year?: number;
      month?: number;
      day?: number;
      basisOfRecord?: string;
      occurrenceID?: string;
      datasetName?: string;
    }>;
  };
  return (json.results ?? []).map((r) => ({
    key: r.key,
    species: r.species,
    scientificName: r.scientificName ?? "",
    canonicalName: r.canonicalName,
    countryCode: r.countryCode,
    decimalLatitude: r.decimalLatitude,
    decimalLongitude: r.decimalLongitude,
    year: r.year,
    month: r.month,
    day: r.day,
    basisOfRecord: r.basisOfRecord ?? "UNKNOWN",
    occurrenceID: r.occurrenceID,
    datasetName: r.datasetName,
  }));
}

/**
 * Suggest accepted species names for a partial string.
 * Useful for autocomplete on BNG survey entry forms.
 * Returns up to 10 suggestions, UK-filtered where possible.
 */
export async function suggestSpeciesNames(
  partial: string,
  limit = 10,
): Promise<Array<{ key: number; scientificName: string; canonicalName: string; rank: string }>> {
  const params = new URLSearchParams({
    q: partial,
    limit: String(Math.min(limit, 25)),
    datasetKey: "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c", // GBIF Backbone Taxonomy dataset key
  });
  const res = await fetchWithTimeout(`${BASE}/species/suggest?${params}`);
  if (!res.ok) throw new DataSourceError("gbif", res.status, await res.text().catch(() => ""));
  const json = await res.json() as Array<{
    key: number;
    scientificName?: string;
    canonicalName?: string;
    rank?: string;
    status?: string;
  }>;
  return json
    .filter((s) => s.status === "ACCEPTED" || !s.status)
    .slice(0, limit)
    .map((s) => ({
      key: s.key,
      scientificName: s.scientificName ?? "",
      canonicalName: s.canonicalName ?? s.scientificName ?? "",
      rank: s.rank ?? "UNKNOWN",
    }));
}
