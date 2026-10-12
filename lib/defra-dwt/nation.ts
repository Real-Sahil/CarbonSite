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
// Every other UK postcode area in England and Wales. Listed, not inferred: an area missing here (or a typo such as
// "XX") is unknown and yields null, never England.
const ENGLAND_AND_WALES_AREAS = new Set(
  "AL B BA BB BD BH BL BN BR BS CA CB CF CH CM CO CR CT CV CW DA DE DH DL DN DT DY E EC EN EX FY GL GU HA HD HG HP HR HU HX IG IP KT L LA LD LE LL LN LS LU M ME MK N NE NG NN NP NR NW OL OX PE PL PO PR RG RH RM S SA SE SG SK SL SM SN SO SP SR SS ST SW SY TF TN TQ TR TS TW UB W WA WC WD WF WN WR WS WV YO".split(" "),
);

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
  if (ENGLAND_AND_WALES_AREAS.has(area)) return "england-and-wales";
  return null;
}

/**
 * The nation whose bank holidays apply to a receiving site, or null when it cannot be told.
 * The region and the postcode are each read on their own. When both give a nation and they disagree, the site
 * data is contradictory and neither is trusted. Null is never defaulted to England: the caller must say the
 * site's nation is missing and where to add it.
 */
export function siteNation(site: SiteLocation): Nation | null {
  const country = site.country?.trim().toLowerCase();
  if (country && !UK_NAMES.has(country)) return null;
  const fromText = site.region ? fromRegion(site.region) : null;
  const fromCode = site.postcode ? fromPostcode(site.postcode) : null;
  if (fromText && fromCode && fromText !== fromCode) return null;
  return fromText ?? fromCode;
}
