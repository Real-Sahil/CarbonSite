/**
 * legislation.gov.uk API client.
 *
 * Base: https://www.legislation.gov.uk/
 * Docs: https://www.legislation.gov.uk/developer/contents
 * Licence: Open Government Licence v3.0 (Crown Copyright)
 * No API key required. ATOM/XML feed and JSON REST API.
 *
 * Used by the Legal Register module to:
 *  - Look up environmental acts and statutory instruments by title / year
 *  - Track changes to regulations that affect an org's environmental obligations
 *  - Populate the LegalRegisterItem.source / .reference fields automatically
 *
 * Note: The legislation.gov.uk API returns XML/ATOM; this client parses the
 * ATOM feed via regex/string ops to avoid a DOM parser dependency in the
 * Next.js edge runtime.  Full legislative text is large — we store only
 * metadata (title, year, type, last-amended) in the platform's legal register.
 */

import { DataSourceError } from "./types";

const BASE = "https://www.legislation.gov.uk";
const TIMEOUT_MS = 15_000;

export interface LegislationItem {
  /** Internal legislation.gov.uk identifier e.g. "ukpga/1990/43" */
  id: string;
  /** Human-readable title */
  title: string;
  /** Type: "ukpga" | "uksi" | "ukdsi" | "eur" | other */
  type: string;
  /** Year enacted or made */
  year: number;
  /** Legislation number (chapter for Acts, SI number for SIs) */
  number: string;
  /** ISO 8601 date string of most recent amendment, if known */
  lastAmended?: string;
  /** Canonical URL on legislation.gov.uk */
  url: string;
}

async function fetchWithTimeout(url: string, accept = "application/atom+xml"): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: accept,
        "User-Agent": "MetricOra/1.0 (environmental compliance platform)",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Extract text between XML tags — simple string parser, no DOM dependency. */
function extractTag(xml: string, tag: string): string | undefined {
  const start = xml.indexOf(`<${tag}`);
  if (start === -1) return undefined;
  const end = xml.indexOf(`</${tag}>`, start);
  if (end === -1) return undefined;
  const inner = xml.slice(start, end + `</${tag}>`.length);
  // Strip the opening tag (possibly with attributes) to get the text content
  const tagClose = inner.indexOf(">");
  return inner.slice(tagClose + 1, inner.lastIndexOf("<")).trim();
}

/** Parse a legislation.gov.uk ATOM entry element into a LegislationItem. */
function parseAtomEntry(entry: string): LegislationItem | null {
  try {
    const id = extractTag(entry, "leg:id") ?? extractTag(entry, "id") ?? "";
    const title = extractTag(entry, "title") ?? "";
    // Extract relative path from id field e.g. "/id/ukpga/1990/43"
    const pathMatch = id.match(/\/(uk(?:pga|si|dsi|la|asp|wsi|nisi)|eur)\/(\d{4})\/(\d+)/);
    if (!pathMatch) return null;
    const [, type, yearStr, number] = pathMatch;
    const year = parseInt(yearStr, 10);
    const lastAmended = extractTag(entry, "dct:modified") ?? extractTag(entry, "updated");
    return {
      id: `${type}/${year}/${number}`,
      title,
      type,
      year,
      number,
      lastAmended: lastAmended || undefined,
      url: `${BASE}/${type}/${year}/${number}`,
    };
  } catch {
    return null;
  }
}

/**
 * Search for UK legislation by keyword.
 * Returns matching Acts and Statutory Instruments, newest first.
 * Most relevant for environmental law: type="ukpga" (UK Public General Acts)
 * and type="uksi" (UK Statutory Instruments).
 */
export async function searchLegislation(
  query: string,
  opts: { type?: "ukpga" | "uksi" | "all"; limit?: number } = {},
): Promise<LegislationItem[]> {
  const { type = "all", limit = 20 } = opts;
  const params = new URLSearchParams({
    title: query,
    "results-count": String(Math.min(limit, 100)),
    sort: "relevant",
    ...(type !== "all" ? { type } : {}),
  });
  const url = `${BASE}/search/results.feed?${params}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("legislation.gov.uk", res.status, await res.text().catch(() => ""));
  const xml = await res.text();

  // Split on <entry> tags and parse each
  const entries: LegislationItem[] = [];
  const parts = xml.split("<entry>");
  for (let i = 1; i < parts.length; i++) {
    const item = parseAtomEntry(parts[i]);
    if (item) entries.push(item);
  }
  return entries.slice(0, limit);
}

/**
 * Fetch metadata for a specific piece of legislation by its ID path
 * (e.g. "ukpga/1990/43" for the Environmental Protection Act 1990).
 */
export async function getLegislationByPath(path: string): Promise<LegislationItem | null> {
  const cleanPath = path.replace(/^\//, "");
  const url = `${BASE}/id/${cleanPath}`;
  // legislation.gov.uk redirects /id/ to the canonical URI; follow it
  const res = await fetchWithTimeout(url, "application/json");
  if (res.status === 404) return null;
  if (!res.ok) throw new DataSourceError("legislation.gov.uk", res.status, await res.text().catch(() => ""));

  // The redirect target encodes the metadata in the URL segments
  const canonical = res.url ?? url;
  const match = canonical.match(/\/(uk(?:pga|si|dsi|la|asp|wsi|nisi)|eur)\/(\d{4})\/(\d+)/);
  if (!match) return null;
  const [, type, yearStr, number] = match;

  // Try to fetch the ATOM entry for title / last-amended
  const atomUrl = `${BASE}/${type}/${yearStr}/${number}/data.feed`;
  const atomRes = await fetchWithTimeout(atomUrl).catch(() => null);
  let title = `${type.toUpperCase()} ${yearStr}/${number}`;
  let lastAmended: string | undefined;
  if (atomRes?.ok) {
    const xml = await atomRes.text().catch(() => "");
    title = extractTag(xml, "title") ?? title;
    lastAmended = extractTag(xml, "dct:modified") ?? extractTag(xml, "updated");
  }
  return {
    id: `${type}/${yearStr}/${number}`,
    title,
    type,
    year: parseInt(yearStr, 10),
    number,
    lastAmended: lastAmended || undefined,
    url: `${BASE}/${type}/${yearStr}/${number}`,
  };
}

/**
 * Curated list of core UK environmental legislation paths.
 * Used to seed the Legal Register with the Acts most platforms need to track.
 */
export const UK_ENVIRONMENTAL_LEGISLATION: Array<{ path: string; description: string }> = [
  { path: "ukpga/1990/43", description: "Environmental Protection Act 1990" },
  { path: "ukpga/1995/25", description: "Environment Act 1995" },
  { path: "ukpga/2021/30", description: "Environment Act 2021" },
  { path: "ukpga/1999/24", description: "Pollution Prevention and Control Act 1999" },
  { path: "ukpga/1974/40", description: "Health and Safety at Work etc. Act 1974" },
  { path: "ukpga/2008/27", description: "Climate Change Act 2008" },
  { path: "uksi/2010/675",  description: "Environmental Permitting (England and Wales) Regulations 2010" },
  { path: "uksi/2011/988",  description: "Waste (England and Wales) Regulations 2011" },
  { path: "uksi/2016/691",  description: "Hazardous Waste (England and Wales) Regulations 2016" },
  { path: "uksi/2005/2773", description: "Water Resources (Control of Pollution) (Silage, Slurry and Agricultural Fuel Oil) (England) Regulations 2010" },
  { path: "uksi/2014/3248", description: "Water Industry (Specified Infrastructure Projects) (English Undertakers) Regulations 2013" },
  { path: "uksi/2018/110",  description: "Environmental Assessment of Plans and Programmes Regulations 2004" },
  { path: "ukpga/1997/66",  description: "Noise Act 1996" },
  { path: "ukpga/1993/12",  description: "Clean Air Act 1993" },
  { path: "uksi/2009/1263", description: "Conservation of Habitats and Species Regulations 2017" },
  { path: "uksi/2017/1012", description: "Conservation of Habitats and Species Regulations 2017 (as amended)" },
];
