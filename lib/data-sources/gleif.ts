/**
 * GLEIF LEI (Legal Entity Identifier) API client.
 *
 * Base: https://api.gleif.org/api/v1
 * Docs: https://www.gleif.org/en/lei-data/gleif-api
 * Licence: free, no auth, no API key required.
 * Coverage: ~2.4M registered legal entities globally.
 *
 * Used to auto-populate LegalEntity.gleifLei and company metadata
 * (name, country, parent) from a registration number or company name lookup.
 */

import { DataSourceError } from "./types";

const BASE = "https://api.gleif.org/api/v1";
const TIMEOUT_MS = 10_000;

export interface GleifEntity {
  lei: string;
  /** Legal name of the entity */
  legalName: string;
  legalJurisdiction: string; // ISO 3166-1 alpha-2
  status: "ISSUED" | "LAPSED" | "RETIRED" | "PENDING_TRANSFER" | "PENDING_ARCHIVAL" | "DUPLICATE";
  /** Registration number in the national registry */
  registrationNumber: string | null;
  /** LEI of the direct parent, if any */
  directParentLei: string | null;
  /** Registered address */
  registeredAddressCountry: string | null;
  nextRenewalDate: string | null;
}

interface GleifApiRelationship {
  attributes?: {
    directParent?: {
      qualified?: { lei?: string };
    };
  };
}

interface GleifApiRecord {
  attributes?: {
    lei?: string;
    entity?: {
      legalName?: { name?: string };
      legalJurisdiction?: string;
      status?: string;
      registeredAddress?: { country?: string };
    };
    registration?: {
      managingLou?: string;
      nextRenewalDate?: string;
      registrationNumber?: string;
    };
  };
  relationships?: {
    directParent?: GleifApiRelationship;
  };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.api+json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseRecord(record: GleifApiRecord): GleifEntity {
  const attrs = record.attributes ?? {};
  const entity = attrs.entity ?? {};
  return {
    lei: attrs.lei ?? "",
    legalName: entity.legalName?.name ?? "",
    legalJurisdiction: entity.legalJurisdiction ?? "",
    status: (entity.status ?? "ISSUED") as GleifEntity["status"],
    registrationNumber: attrs.registration?.registrationNumber ?? null,
    directParentLei: record.relationships?.directParent?.attributes?.directParent?.qualified?.lei ?? null,
    registeredAddressCountry: entity.registeredAddress?.country ?? null,
    nextRenewalDate: attrs.registration?.nextRenewalDate ?? null,
  };
}

/**
 * Look up a legal entity by its LEI code.
 */
export async function getLeiRecord(lei: string): Promise<GleifEntity | null> {
  const url = `${BASE}/lei-records/${encodeURIComponent(lei)}`;
  const res = await fetchWithTimeout(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new DataSourceError("gleif", res.status, await res.text().catch(() => ""));
  const data = (await res.json()) as { data: GleifApiRecord };
  if (!data.data) return null;
  return parseRecord(data.data);
}

/**
 * Search for a legal entity by company name + country.
 * Returns the best match or null.
 */
export async function searchByName(name: string, country?: string): Promise<GleifEntity | null> {
  const params = new URLSearchParams({ "filter[fulltext]": name, "page[size]": "5" });
  if (country) params.set("filter[entity.legalAddress.country]", country.toUpperCase());

  const url = `${BASE}/lei-records?${params}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("gleif", res.status, await res.text().catch(() => ""));

  const data = (await res.json()) as { data: GleifApiRecord[] };
  const records = data.data ?? [];
  if (records.length === 0) return null;
  return parseRecord(records[0]);
}

/**
 * Search by registration number (Companies House number, EIN, etc.) + country.
 * Most reliable lookup — low false-positive rate.
 */
export async function searchByRegistrationNumber(
  registrationNumber: string,
  country: string,
): Promise<GleifEntity | null> {
  const params = new URLSearchParams({
    "filter[entity.registeredAs]": registrationNumber,
    "filter[entity.legalAddress.country]": country.toUpperCase(),
    "page[size]": "3",
  });

  const url = `${BASE}/lei-records?${params}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("gleif", res.status, await res.text().catch(() => ""));

  const data = (await res.json()) as { data: GleifApiRecord[] };
  const records = data.data ?? [];
  if (records.length === 0) return null;
  return parseRecord(records[0]);
}
