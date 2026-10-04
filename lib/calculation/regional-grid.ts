// State and province electricity factors. Australia (NGA) and Canada (ECCC)
// publish one grid factor per state or province beside a national one. Like
// eGRID subregions (egrid-subregion.ts), a regional row is used only when the
// record's own fuel/detail text names the region or its facility's region
// reads as one; every other record in that country takes the national row, so
// a state is never guessed from the company's headquarters.
//
// Regional rows carry activity type grid_<country>_<code> (a suffix such as
// _upstream marks the Scope 3 row of the same grid). They are only offered to a
// record whose country matches.

import type { EmissionFactor } from "@prisma/client";

type Region = { code: string; names: string[]; abbreviations?: string[] };

const REGIONS: Record<string, Region[]> = {
  au: [
    { code: "nsw", names: ["new south wales", "australian capital territory", "canberra", "sydney"], abbreviations: ["nsw", "act"] },
    { code: "vic", names: ["victoria", "melbourne"], abbreviations: ["vic"] },
    { code: "qld", names: ["queensland", "brisbane"], abbreviations: ["qld"] },
    { code: "sa", names: ["south australia", "adelaide"], abbreviations: ["sa"] },
    // Western Australia is mostly the South West Interconnected System; the North West one is named explicitly.
    { code: "wa", names: ["swis", "south west interconnected", "western australia", "perth"], abbreviations: ["wa"] },
    { code: "nwis", names: ["nwis", "north western interconnected", "north west interconnected", "pilbara"] },
    { code: "tas", names: ["tasmania", "hobart"], abbreviations: ["tas"] },
    { code: "nt", names: ["northern territory", "dkis", "darwin katherine", "darwin"], abbreviations: ["nt"] },
  ],
  ca: [
    { code: "bc", names: ["british columbia", "vancouver"], abbreviations: ["bc"] },
    { code: "ab", names: ["alberta", "calgary", "edmonton"], abbreviations: ["ab"] },
    { code: "sk", names: ["saskatchewan"], abbreviations: ["sk"] },
    { code: "mb", names: ["manitoba", "winnipeg"], abbreviations: ["mb"] },
    { code: "on", names: ["ontario", "toronto", "ottawa"], abbreviations: ["on"] },
    { code: "qc", names: ["quebec", "québec", "montreal", "montréal"], abbreviations: ["qc", "pq"] },
    { code: "nb", names: ["new brunswick"], abbreviations: ["nb"] },
    { code: "ns", names: ["nova scotia", "halifax"], abbreviations: ["ns"] },
    { code: "pe", names: ["prince edward island"], abbreviations: ["pe", "pei"] },
    { code: "nl", names: ["newfoundland", "labrador"], abbreviations: ["nl"] },
    { code: "yt", names: ["yukon"], abbreviations: ["yt"] },
    { code: "nt", names: ["northwest territories", "north west territories"], abbreviations: ["nt", "nwt"] },
    { code: "nu", names: ["nunavut"], abbreviations: ["nu"] },
  ],
};

const REGIONAL = /^grid_([a-z]{2})_([a-z]+)(?:_[a-z0-9_]+)?$/;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const isRegionalGridFactor = (f: Pick<EmissionFactor, "activityType">) => REGIONAL.test(f.activityType ?? "");

/** The grid code the text names in the given country: a full name or place anywhere in the text. Abbreviations are not read from free text ("on" is a word). */
export function regionInText(country: string, text: string | null | undefined): string | null {
  const t = ` ${fold(text ?? "")} `;
  if (!t.trim()) return null;
  for (const r of REGIONS[country] ?? []) {
    if (r.names.some((n) => t.includes(` ${fold(n)} `))) return r.code;
  }
  return null;
}

/** A facility's region field: a name, or exactly an abbreviation ("ON", "NSW"). */
export function regionOfFacility(country: string, region: string | null | undefined): string | null {
  const t = fold(region ?? "");
  if (!t) return null;
  const hit = regionInText(country, region);
  if (hit) return hit;
  for (const r of REGIONS[country] ?? []) if (r.abbreviations?.includes(t)) return r.code;
  return null;
}

export type RegionalPick<T> = { kind: "matched"; factor: T; code: string; assumed?: string } | { kind: "rest"; candidates: T[] };

/**
 * The regional grid row the record's hint or its facility's region names, else
 * the candidates without any regional row. `country` is the record's ISO-2
 * country: regional rows of another country are never offered.
 */
export function pickRegionalGrid<T extends Pick<EmissionFactor, "activityType">>(
  candidates: T[],
  country: string | null | undefined,
  hint: string | null | undefined,
  facilityRegion?: string | null,
): RegionalPick<T> {
  const regional = candidates.filter(isRegionalGridFactor);
  if (!regional.length) return { kind: "rest", candidates };
  const c = (country ?? "").toLowerCase();
  const code: string | null = REGIONS[c] ? (regionInText(c, hint) ?? regionOfFacility(c, facilityRegion)) : null;
  // Prefer the plain row of the grid over its Scope 3 (suffixed) twin when both are in the bucket.
  const named = code
    ? regional.find((f) => f.activityType === `grid_${c}_${code}`) ?? regional.find((f) => (f.activityType ?? "").startsWith(`grid_${c}_${code}_`))
    : undefined;
  if (named) {
    const assumed = c === "au" && code === "wa" && !/swis|south west/i.test(`${hint ?? ""}`) ? "Western Australia is read as the South West Interconnected System (SWIS); name NWIS in the fuel or detail field for the North West grid." : undefined;
    return { kind: "matched", factor: named, code: code ?? "", assumed };
  }
  return { kind: "rest", candidates: candidates.filter((f) => !isRegionalGridFactor(f)) };
}
