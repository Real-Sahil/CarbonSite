// Industry codes for spend-based factors. EPA USEEIO v1.3 publishes one
// factor per 6-digit NAICS code (activityType "naics_<code>"); a spend record
// names its supplier's code in ActivityRecord.industryCode. Without a code,
// NAICS factors are never picked: 1016 equally good candidates would
// otherwise fall to the id tie-break and price all spend as the first
// industry in the list.

import type { EmissionFactor } from "@prisma/client";

const NAICS_ACTIVITY = /^naics_(\d{6})$/;
const NAF_ACTIVITY = /^naf_(\d{2})$/;

/** The 6-digit NAICS code in "236220", "NAICS 236220" or "naics_236220"; null otherwise. */
export function naicsCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(?:naics[\s_:-]*)?(\d{6})$/i);
  return m ? m[1] : null;
}

export const isNaicsFactor = (f: Pick<EmissionFactor, "activityType">) => NAICS_ACTIVITY.test(f.activityType ?? "");

/**
 * The NACE Rev. 2 / NAF / UK SIC 2007 division (first 2 digits) of a code such
 * as "79", "79.11", "79.11Z", "7911", "79110", "N79" or "NAF-N79". A 6-digit
 * number is a NAICS code, not a division, so gives null.
 */
export function nafDivision(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{6}$/.test(s)) return null;
  return s.match(/^(?:NAF[\s_:-]*)?(?:SIC[\s_:-]*)?[A-U]?(\d{2})(?:\.?\d{0,3}[A-Z]?)?$/i)?.[1] ?? null;
}

export const isNafFactor = (f: Pick<EmissionFactor, "activityType">) => NAF_ACTIVITY.test(f.activityType ?? "");
export const isIndustryFactor = (f: Pick<EmissionFactor, "activityType">) => isNaicsFactor(f) || isNafFactor(f);

export type IndustryPick<T> =
  | { kind: "matched"; factor: T; code: string; scheme: "NAICS" | "NAF" }
  | { kind: "not_applicable"; candidates: T[] }
  | { kind: "excluded"; candidates: T[]; code: string | null; scheme: "NAICS" | "NAF" };

/**
 * Among one category's candidates: the factor for the record's industry code
 * (6-digit NAICS for EPA USEEIO, NAF/SIC division for ADEME spend ratios), or
 * the candidates with every industry-priced factor removed.
 */
export function pickIndustry<T extends Pick<EmissionFactor, "activityType">>(candidates: T[], industryCode: string | null | undefined): IndustryPick<T> {
  const naicsFactors = candidates.filter(isNaicsFactor);
  const nafFactors = candidates.filter(isNafFactor);
  if (!naicsFactors.length && !nafFactors.length) return { kind: "not_applicable", candidates };
  const rest = candidates.filter((f) => !isIndustryFactor(f));
  const naics = naicsCode(industryCode);
  if (naicsFactors.length) {
    const exact = naics ? naicsFactors.find((f) => f.activityType === `naics_${naics}`) : undefined;
    if (exact && naics) return { kind: "matched", factor: exact, code: naics, scheme: "NAICS" };
  }
  const division = nafDivision(industryCode);
  if (nafFactors.length) {
    // Several factors can share a division; the first by id keeps it deterministic.
    const exact = division ? nafFactors.filter((f) => f.activityType === `naf_${division}`)[0] : undefined;
    if (exact && division) return { kind: "matched", factor: exact, code: division, scheme: "NAF" };
  }
  return naicsFactors.length
    ? { kind: "excluded", candidates: rest, code: naics, scheme: "NAICS" }
    : { kind: "excluded", candidates: rest, code: division, scheme: "NAF" };
}

/** Warning for a spend record that could not use its library's industry-priced factors. */
export function industryMissingWarning(scheme: "NAICS" | "NAF", code: string | null): string {
  if (scheme === "NAF") {
    return code
      ? `No spend factor for NAF/SIC division ${code} in this library. Check the code.`
      : "This library prices spend by industry. Add the supplier's NAF or UK SIC code (industry code, e.g. 41.20) to the record to use it.";
  }
  return code
    ? `No spend factor for NAICS ${code} in this library. Check the code (6 digits, 2017 NAICS).`
    : "This library prices spend by industry. Add the supplier's 6-digit NAICS code (industry code) to the record to use it.";
}

export const UNVERIFIED_FACTOR_WARNING =
  "The selected factor is marked Unverified (no traceable source or price year). Treat this figure as a rough estimate, or use a sourced factor.";

export const isUnverifiedFactor = (f: Pick<EmissionFactor, "usageNotes">) => (f.usageNotes ?? "").includes("Unverified:");
