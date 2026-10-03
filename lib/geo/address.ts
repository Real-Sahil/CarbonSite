// Address search through Geoapify (free key, OpenStreetMap data). Only the text
// the person typed and an optional country go out: no organisation details.
// The key stays on the server; the browser calls our own route.

const ENDPOINT = "https://api.geoapify.com/v1/geocode/autocomplete";

export type AddressSuggestion = {
  /** One line, as Geoapify formats it. */
  label: string;
  /** Street line: number and street, or the place name. */
  addressLine: string;
  city: string | null;
  region: string | null;
  postcode: string | null;
  /** ISO 3166-1 alpha-2, upper case. */
  country: string | null;
  latitude: number;
  longitude: number;
};

type Raw = {
  formatted?: string;
  housenumber?: string;
  street?: string;
  address_line1?: string;
  name?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  state?: string;
  county?: string;
  postcode?: string;
  country_code?: string;
  lat?: number;
  lon?: number;
};

/** One suggestion from a Geoapify result; null when it has no usable position. */
export function toSuggestion(r: Raw): AddressSuggestion | null {
  if (typeof r.lat !== "number" || typeof r.lon !== "number" || !r.formatted) return null;
  const street = [r.housenumber, r.street].filter(Boolean).join(" ");
  return {
    label: r.formatted,
    addressLine: street || r.address_line1 || r.name || "",
    city: r.city ?? r.town ?? r.village ?? r.suburb ?? null,
    region: r.state ?? r.county ?? null,
    postcode: r.postcode ?? null,
    country: r.country_code ? r.country_code.toUpperCase() : null,
    latitude: r.lat,
    longitude: r.lon,
  };
}

export class GeocoderUnavailable extends Error {}

/** Up to five suggestions for the typed text. Throws GeocoderUnavailable with no key or when the service fails. */
export async function suggestAddresses(
  text: string,
  opts: { country?: string | null; apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<AddressSuggestion[]> {
  const key = opts.apiKey ?? process.env.GEOAPIFY_API_KEY;
  if (!key) throw new GeocoderUnavailable("No address search key is configured.");
  const q = new URLSearchParams({ text: text.trim(), limit: "5", format: "json", lang: "en", apiKey: key });
  if (opts.country && /^[A-Za-z]{2}$/.test(opts.country)) q.set("filter", `countrycode:${opts.country.toLowerCase()}`);
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(`${ENDPOINT}?${q}`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new GeocoderUnavailable("Address search did not answer.");
  }
  if (!res.ok) throw new GeocoderUnavailable(`Address search answered ${res.status}.`);
  const json = (await res.json().catch(() => null)) as { results?: Raw[] } | null;
  return (json?.results ?? []).map(toSuggestion).filter((s): s is AddressSuggestion => s !== null);
}

/** Open Location Code (Plus Code) for a position, 10 digits (about 14 m). For places with no postcode. */
export function plusCode(lat: number, lon: number): string {
  const A = "23456789CFGHJMPQRVWX";
  const clipLat = Math.min(90, Math.max(-90, lat));
  let l = clipLat === 90 ? 90 - 0.000125 : clipLat;
  l += 90;
  let g = lon;
  while (g < -180) g += 360;
  while (g >= 180) g -= 360;
  g += 180;
  // Work in integer units of 1/8000 degree (the last grid row) to avoid float drift.
  let latUnits = Math.floor(l * 8000 + 1e-6);
  let lonUnits = Math.floor(g * 8000 + 1e-6);
  // Pairs 1-5 are base 20 (resolutions 20, 1, 0.05, 0.0025, 0.000125 degrees).
  let code = "";
  const lonDigits: string[] = [];
  const latDigits: string[] = [];
  for (let i = 0; i < 5; i++) {
    latDigits.unshift(A[latUnits % 20]);
    lonDigits.unshift(A[lonUnits % 20]);
    latUnits = Math.floor(latUnits / 20);
    lonUnits = Math.floor(lonUnits / 20);
  }
  for (let i = 0; i < 5; i++) code += latDigits[i] + lonDigits[i];
  return `${code.slice(0, 8)}+${code.slice(8)}`;
}
