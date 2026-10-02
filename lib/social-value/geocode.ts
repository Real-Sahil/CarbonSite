import { normalisePostcode, type LatLng } from "@/lib/social-value/local-spend";

/**
 * Postcode to coordinates through postcodes.io (public, no key, Ordnance
 * Survey open data). Only postcodes are sent: no supplier names, spend or
 * organisation details. Bulk lookups take 100 postcodes at a time.
 */
const ENDPOINT = "https://api.postcodes.io/postcodes";
const BATCH = 100;

type Fetch = typeof fetch;

export async function geocodePostcodes(
  postcodes: string[],
  fetchImpl: Fetch = fetch,
): Promise<Map<string, LatLng | null>> {
  const out = new Map<string, LatLng | null>();
  const wanted = [...new Set(postcodes.map(normalisePostcode).filter((p): p is string => p !== null))];
  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcodes: batch }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`postcodes.io answered ${res.status}`);
    const json = (await res.json()) as {
      result?: { query: string; result: { latitude: number | null; longitude: number | null } | null }[];
    };
    for (const row of json.result ?? []) {
      const key = normalisePostcode(row.query);
      if (!key) continue;
      const r = row.result;
      out.set(key, r && r.latitude != null && r.longitude != null ? { latitude: r.latitude, longitude: r.longitude } : null);
    }
  }
  return out;
}
