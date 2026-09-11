/**
 * NBN Atlas (National Biodiversity Network) species records API client.
 *
 * Base: https://records-ws.nbnatlas.org/
 * Docs: https://nbnatlas.org/api/
 * Licence: Open Government Licence v3.0 (occurrence records)
 * No API key required for public read access.
 *
 * Provides UK species occurrence records, protected species presence at a
 * location, and habitat-linked species groups. Used by the BNG module to
 * build a baseline species list for a facility.
 */

import { DataSourceError } from "./types";

const BASE = "https://records-ws.nbnatlas.org";
const TIMEOUT_MS = 12_000;

export interface SpeciesOccurrence {
  taxonConceptID: string;
  scientificName: string;
  vernacularName?: string;
  kingdom?: string;
  phylum?: string;
  classs?: string;
  order?: string;
  family?: string;
  genus?: string;
  occurrenceCount: number;
  conservationStatus?: string;
  /** Whether the species has any Schedule 5/8/41 protection in UK law */
  isProtected: boolean;
}

export interface SpeciesGroupSummary {
  speciesGroup: string;
  count: number;
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
 * Returns species occurrences recorded within `radiusKm` of a point.
 * Results are deduplicated to one entry per taxon concept.
 */
export async function getSpeciesNearPoint(
  lat: number,
  lng: number,
  radiusKm = 2,
  maxResults = 50,
): Promise<SpeciesOccurrence[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    radius: String(radiusKm),
    pageSize: String(maxResults),
    facets: "species_group",
  });
  const res = await fetchWithTimeout(`${BASE}/occurrences/search?${params}`);
  if (!res.ok) throw new DataSourceError("nbn-atlas", res.status, await res.text().catch(() => ""));
  const json = await res.json() as {
    occurrences?: Array<{
      taxonConceptID?: string;
      scientificName?: string;
      vernacularName?: string;
      kingdom?: string;
      phylum?: string;
      classs?: string;
      order?: string;
      family?: string;
      genus?: string;
      countryConservation?: string;
    }>;
    totalRecords?: number;
  };

  // Deduplicate by taxon concept ID
  const seen = new Set<string>();
  const results: SpeciesOccurrence[] = [];
  for (const occ of json.occurrences ?? []) {
    const id = occ.taxonConceptID ?? occ.scientificName ?? "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const conservation = occ.countryConservation ?? "";
    results.push({
      taxonConceptID: id,
      scientificName: occ.scientificName ?? "",
      vernacularName: occ.vernacularName,
      kingdom: occ.kingdom,
      phylum: occ.phylum,
      classs: occ.classs,
      order: occ.order,
      family: occ.family,
      genus: occ.genus,
      occurrenceCount: 1,
      conservationStatus: conservation || undefined,
      isProtected: /schedule|protected|endangered|critically/i.test(conservation),
    });
  }
  return results;
}

/**
 * Returns a count of species records by taxonomic group near a point.
 * Useful for a quick BNG species-richness summary card.
 */
export async function getSpeciesGroupSummary(
  lat: number,
  lng: number,
  radiusKm = 2,
): Promise<SpeciesGroupSummary[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    radius: String(radiusKm),
    pageSize: "0",
    facets: "species_group",
  });
  const res = await fetchWithTimeout(`${BASE}/occurrences/search?${params}`);
  if (!res.ok) throw new DataSourceError("nbn-atlas", res.status, await res.text().catch(() => ""));
  const json = await res.json() as {
    facetResults?: Array<{
      fieldName: string;
      fieldResult: Array<{ label: string; count: number }>;
    }>;
  };
  const groupFacet = json.facetResults?.find((f) => f.fieldName === "species_group");
  return (groupFacet?.fieldResult ?? []).map((r) => ({
    speciesGroup: r.label,
    count: r.count,
  }));
}
