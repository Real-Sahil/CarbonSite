// Which regulatory regions an organisation's operations touch, from its HQ
// country and the countries of its facilities. The regulatory calendar shows
// those regions first, so a German company is not led through UK SECR and a UK
// company with a site in Dublin still sees the EU. Regions with no rules loaded
// say so instead of showing nothing.

export type Region = "uk" | "eu" | "uae";

const EU_27 = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

/** The region whose rules are loaded for an ISO 3166-1 alpha-2 country, if any. */
export function regionOf(country: string | null | undefined): Region | null {
  const c = (country ?? "").trim().toUpperCase();
  if (c === "GB") return "uk";
  if (c === "AE") return "uae";
  return EU_27.has(c) ? "eu" : null;
}

/** Regions touched by the HQ and any facility country, and the countries that have none loaded. */
export function relevantRegions(
  hqCountry: string | null | undefined,
  facilityCountries: Array<string | null | undefined>,
): { regions: Region[]; unloaded: string[] } {
  const regions = new Set<Region>();
  const unloaded = new Set<string>();
  for (const raw of [hqCountry, ...facilityCountries]) {
    const c = (raw ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) continue;
    const r = regionOf(c);
    if (r) regions.add(r);
    else unloaded.add(c);
  }
  return { regions: [...regions], unloaded: [...unloaded].sort() };
}
