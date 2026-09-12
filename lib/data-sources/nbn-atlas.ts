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
  conservationStatus?: string;
}

interface NbnSearchResponse {
  totalRecords: number;
  occurrences?: Array<{
    scientificName?: string;
    vernacularName?: string;
    kingdom?: string;
    classs?: string;
    speciesGroup?: string;
    taxonConceptID?: string;
    year?: number;
    countryConservation?: string;
  }>;
}

// IUCN / UK conservation risk levels, derived from NBN Atlas countryConservation strings.
export type ConservationRisk = "critical" | "endangered" | "vulnerable" | "near_threatened" | "protected" | "least_concern" | "unknown";

export function conservationRisk(status: string | undefined): ConservationRisk {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (/critically.endangered|\\bCR\\b/.test(s)) return "critical";
  if (/\\bendangered\\b|\\bEN\\b/.test(s)) return "endangered";
  if (/vulnerable|\\bVU\\b/.test(s)) return "vulnerable";
  if (/near.threatened|\\bNT\\b/.test(s)) return "near_threatened";
  if (/schedule [158]|protected|wildlife.*act/i.test(s)) return "protected";
  if (/least.concern|\\bLC\\b/.test(s)) return "least_concern";
  return "unknown";
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

// Map NBN Atlas speciesGroup strings to our classification keys.
// NBN Atlas returns e.g. "Birds", "Mammals", "Plants", "Insects" etc.
const NBN_GROUP_MAP: Record<string, keyof typeof GROUP_KEYWORDS> = {
  birds:       "birds",
  aves:        "birds",
  mammals:     "mammals",
  mammalia:    "mammals",
  plants:      "plants",
  plantae:     "plants",
  bryophytes:  "plants",
  lichens:     "plants",
  insects:     "invertebrates",
  insecta:     "invertebrates",
  invertebrates: "invertebrates",
  arachnids:   "invertebrates",
  molluscs:    "invertebrates",
  crustaceans: "invertebrates",
  reptiles:    "reptiles",
  reptilia:    "reptiles",
  amphibians:  "amphibians",
  amphibia:    "amphibians",
};

function classifyFromNbnGroup(speciesGroup: string | undefined, kingdom: string, classs: string | undefined): keyof typeof GROUP_KEYWORDS | "other" {
  // Prefer the API's own speciesGroup label — it's already human-readable.
  if (speciesGroup) {
    const key = NBN_GROUP_MAP[speciesGroup.toLowerCase()];
    if (key) return key;
  }
  // Fallback: check class-level taxonomy (kingdom alone is always "Animalia"/"Plantae").
  const combined = `${kingdom} ${classs ?? ""}`;
  return classifyGroup(kingdom, classs ?? combined);
}

const MAX_SPECIES_PAGES = 10;
const PAGE_SIZE = 200;

export async function scanSpecies(
  lat: number,
  lon: number,
  radiusKm = 1,
): Promise<NbnScanResult> {
  const seen = new Map<string, { record: NbnSpeciesRecord; count: number }>();
  let totalRecords = 0;

  for (let page = 0; page < MAX_SPECIES_PAGES; page++) {
    const start = page * PAGE_SIZE;
    const url =
      `${BASE}/occurrences/search?q=*` +
      `&lat=${lat}&lon=${lon}&radius=${radiusKm}` +
      `&pageSize=${PAGE_SIZE}&startIndex=${start}` +
      `&sort=taxonConceptID&dir=asc`;

    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new DataSourceError("nbn-atlas", res.status, await res.text().catch(() => ""));
    const data = await res.json() as NbnSearchResponse;

    if (page === 0) totalRecords = data.totalRecords;

    const occurrences = data.occurrences ?? [];
    if (occurrences.length === 0) break;

    for (const occ of occurrences) {
      const name = occ.scientificName ?? "";
      if (!name) continue;
      const existing = seen.get(name);
      if (existing) {
        existing.count++;
        // Update lastSeen to the most recent year observed.
        if (occ.year && (!existing.record.lastSeen || occ.year > Number(existing.record.lastSeen))) {
          existing.record.lastSeen = String(occ.year);
        }
      } else {
        seen.set(name, {
          count: 1,
          record: {
            name,
            commonName: occ.vernacularName ?? null,
            kingdom: occ.kingdom ?? "Unknown",
            group: occ.speciesGroup ?? occ.classs ?? occ.kingdom ?? "Unknown",
            occurrenceCount: 1,
            lastSeen: occ.year ? String(occ.year) : null,
            conservationStatus: occ.countryConservation || undefined,
          },
        });
      }
    }

    // Fetched all available records.
    if (start + occurrences.length >= data.totalRecords) break;
  }

  // Write aggregated occurrence counts back.
  const speciesRecords: NbnSpeciesRecord[] = [];
  for (const { record, count } of seen.values()) {
    record.occurrenceCount = count;
    speciesRecords.push(record);
  }

  const counts = {
    plants: 0, birds: 0, mammals: 0,
    invertebrates: 0, reptiles: 0, amphibians: 0, other: 0,
  };
  for (const s of speciesRecords) {
    const nbnGroup = s.group;
    const g = classifyFromNbnGroup(nbnGroup, s.kingdom, undefined);
    if (g === "invertebrates") counts.invertebrates++;
    else if (g === "reptiles") counts.reptiles++;
    else if (g === "amphibians") counts.amphibians++;
    else if (g === "other") counts.other++;
    else counts[g as "plants" | "birds" | "mammals"]++;
  }

  return {
    // Unique species found (not occurrence records).
    totalSpeciesCount: seen.size,
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
