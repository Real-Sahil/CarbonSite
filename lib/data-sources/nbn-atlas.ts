/**
 * NBN Atlas (National Biodiversity Network) species records API client.
 *
 * Base: https://records-ws.nbnatlas.org/
 * No API key required for public read access.
 */

import { DataSourceError } from "./types";

const BASE = "https://records-ws.nbnatlas.org";
const TIMEOUT_MS = 15_000;

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

// ---------------------------------------------------------------------------
// Legacy BNG-module exports (used by the facility enrichment route)
// ---------------------------------------------------------------------------

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
  isProtected: boolean;
}

export interface SpeciesGroupSummary {
  speciesGroup: string;
  count: number;
}

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
  };

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

// ---------------------------------------------------------------------------
// Ecology scan: full species list for project-level habitat reports
// ---------------------------------------------------------------------------

export interface NbnSpeciesRecord {
  name: string;
  commonName: string | null;
  kingdom: string;
  group: string;
  occurrenceCount: number;
  lastSeen: string | null;
}

interface NbnSearchResponse {
  totalRecords: number;
  occurrences?: Array<{
    scientificName?: string;
    vernacularName?: string;
    kingdom?: string;
    taxonConceptID?: string;
    year?: number;
  }>;
}

const GROUP_KEYWORDS: Record<string, string[]> = {
  plants:        ["Plantae", "Tracheophyta", "Bryophyta", "Chlorophyta"],
  birds:         ["Aves"],
  mammals:       ["Mammalia"],
  invertebrates: ["Insecta", "Arachnida", "Mollusca", "Annelida", "Crustacea", "Myriapoda"],
  reptiles:      ["Reptilia"],
  amphibians:    ["Amphibia"],
};

function classifyGroup(kingdom: string, group: string): keyof typeof GROUP_KEYWORDS | "other" {
  const combined = `${kingdom} ${group}`;
  for (const [key, keywords] of Object.entries(GROUP_KEYWORDS)) {
    if (keywords.some((k) => combined.includes(k))) return key as keyof typeof GROUP_KEYWORDS;
  }
  return "other";
}

export interface NbnScanResult {
  totalSpeciesCount: number;
  plantSpeciesCount: number;
  birdSpeciesCount: number;
  mammalSpeciesCount: number;
  invertSpeciesCount: number;
  reptileSpeciesCount: number;
  amphibianSpeciesCount: number;
  otherSpeciesCount: number;
  speciesRecords: NbnSpeciesRecord[];
}

export async function scanSpecies(
  lat: number,
  lon: number,
  radiusKm = 1,
): Promise<NbnScanResult> {
  const pageSize = 200;
  const url =
    `${BASE}/occurrences/search?q=*` +
    `&lat=${lat}&lon=${lon}&radius=${radiusKm}` +
    `&pageSize=${pageSize}` +
    `&sort=taxonConceptID&dir=asc` +
    `&facets=species_group&flimit=100`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("nbn-atlas", res.status, await res.text().catch(() => ""));
  const data = await res.json() as NbnSearchResponse;

  const seen = new Map<string, NbnSpeciesRecord>();
  for (const occ of data.occurrences ?? []) {
    const name = occ.scientificName ?? "";
    if (!name || seen.has(name)) continue;
    const group = occ.kingdom ?? "Unknown";
    seen.set(name, {
      name,
      commonName: occ.vernacularName ?? null,
      kingdom: occ.kingdom ?? "Unknown",
      group,
      occurrenceCount: 1,
      lastSeen: occ.year ? String(occ.year) : null,
    });
  }

  const speciesRecords = Array.from(seen.values());

  const counts = {
    plants: 0, birds: 0, mammals: 0,
    invertebrates: 0, reptiles: 0, amphibians: 0, other: 0,
  };
  for (const s of speciesRecords) {
    const g = classifyGroup(s.kingdom, s.group);
    if (g === "invertebrates") counts.invertebrates++;
    else if (g === "reptiles") counts.reptiles++;
    else if (g === "amphibians") counts.amphibians++;
    else if (g === "other") counts.other++;
    else counts[g as "plants" | "birds" | "mammals"]++;
  }

  return {
    totalSpeciesCount: data.totalRecords,
    plantSpeciesCount: counts.plants,
    birdSpeciesCount: counts.birds,
    mammalSpeciesCount: counts.mammals,
    invertSpeciesCount: counts.invertebrates,
    reptileSpeciesCount: counts.reptiles,
    amphibianSpeciesCount: counts.amphibians,
    otherSpeciesCount: counts.other,
    speciesRecords,
  };
}
