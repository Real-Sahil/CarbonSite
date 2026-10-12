import type { Nation } from "./bank-holidays";

export interface SiteLocation {
  country?: string | null;
  region?: string | null;
  postcode?: string | null;
}

// Postcode areas wholly in Scotland. TD and DG also cover English addresses, so they are left out
// rather than guessed.
const SCOTTISH_AREAS = new Set(["AB", "DD", "EH", "FK", "G", "HS", "IV", "KA", "KW", "KY", "ML", "PA", "PH", "ZE"]);
// Not covered by Defra's waste tracking.
const OUTSIDE_AREAS = new Set(["IM", "JE", "GY"]);
const AMBIGUOUS_AREAS = new Set(["TD", "DG"]);

const UK_NAMES = new Set(["gb", "uk", "united kingdom", "great britain", "england", "scotland", "wales", "northern ireland"]);

function fromRegion(region: string): Nation | null {
  const text = region.trim().toLowerCase();
  if (text === "england" || text === "wales" || text === "cymru") return "england-and-wales";
  if (text === "scotland") return "scotland";
  if (text === "northern ireland") return "northern-ireland";
  return null;
}

function fromPostcode(postcode: string): Nation | null {
  const area = /^([A-Z]{1,2})\d/.exec(postcode.trim().toUpperCase().replace(/\s+/g, ""))?.[1];
  if (!area || OUTSIDE_AREAS.has(area) || AMBIGUOUS_AREAS.has(area)) return null;
  if (area === "BT") return "northern-ireland";
  if (SCOTTISH_AREAS.has(area)) return "scotland";
  return "england-and-wales";
}

/**
 * The nation whose bank holidays apply to a receiving site, or null when it cannot be told.
 * The region the person entered wins, then the postcode. Null is never defaulted to England:
 * the caller must say the site's nation is missing and where to add it.
 */
export function siteNation(site: SiteLocation): Nation | null {
  const country = site.country?.trim().toLowerCase();
  if (country && !UK_NAMES.has(country)) return null;
  if (site.region) {
    const fromText = fromRegion(site.region);
    if (fromText) return fromText;
  }
  if (site.postcode) return fromPostcode(site.postcode);
  return null;
}
