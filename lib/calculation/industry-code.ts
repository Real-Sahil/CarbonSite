// Industry codes for spend-based factors. EPA USEEIO v1.3 publishes one
// factor per 6-digit NAICS code (activityType "naics_<code>"); a spend record
// names its supplier's code in ActivityRecord.industryCode. Without a code,
// NAICS factors are never picked: 1016 equally good candidates would
// otherwise fall to the id tie-break and price all spend as the first
// industry in the list.
//
// Three schemes, one per library: NAICS-6 (EPA USEEIO, "naics_<code>"), NAF
// division (ADEME spend ratios, "naf_<2 digits>") and UK SIC 2007 product
// groups (Defra UK spend multipliers, "uksic_<group>", matched on the longest
// SIC prefix the group covers).

import type { EmissionFactor } from "@prisma/client";
import { groupPrefixes } from "../factors/uk-spend";

const NAICS_ACTIVITY = /^naics_(\d{6})$/;
const NAF_ACTIVITY = /^naf_(\d{2})$/;
const UKSIC_ACTIVITY = /^uksic_(.+)$/;

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
export const isUkSicFactor = (f: Pick<EmissionFactor, "activityType">) => UKSIC_ACTIVITY.test(f.activityType ?? "");
export const isIndustryFactor = (f: Pick<EmissionFactor, "activityType">) => isNaicsFactor(f) || isNafFactor(f) || isUkSicFactor(f);

export type IndustryScheme = "NAICS" | "NAF" | "UK SIC";

/**
 * The digits of a UK SIC 2007 (or NACE) code: "41.20" and "41201" give
 * "4120" and "41201", "SIC 01.11" gives "0111". Null for a 6-digit NAICS
 * code or anything without at least 2 digits.
 */
export function ukSicDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{6}$/.test(s)) return null;
  const m = s.match(/^(?:(?:UK\s*)?SIC(?:\s*2007)?[\s_:-]*)?[A-U]?\s*(\d{1,2})(?:\.(\d{1,3}))?(?:\/\d)?[A-Z]?$/i)
    ?? s.match(/^(?:(?:UK\s*)?SIC(?:\s*2007)?[\s_:-]*)?(\d{2})(\d{1,3})$/i);
  if (!m) return null;
  const div = m[1].padStart(2, "0");
  return div + (m[2] ?? "");
}

/** The UK SIC group factor covering the code, by its longest matching prefix. */
function ukSicMatch<T extends Pick<EmissionFactor, "activityType">>(factors: T[], digits: string): T | undefined {
  let best: { f: T; len: number } | undefined;
  for (const f of factors) {
    const key = f.activityType!.match(UKSIC_ACTIVITY)![1];
    let prefixes: string[];
    try { prefixes = groupPrefixes(key); } catch { continue; }
    for (const p of prefixes) {
      if (digits.startsWith(p) && (!best || p.length > best.len)) best = { f, len: p.length };
    }
  }
  return best?.f;
}

export type IndustryPick<T> =
  | { kind: "matched"; factor: T; code: string; scheme: IndustryScheme }
  | { kind: "not_applicable"; candidates: T[] }
  | { kind: "excluded"; candidates: T[]; code: string | null; scheme: IndustryScheme };

/**
 * Among one category's candidates: the factor for the record's industry code
 * (6-digit NAICS for EPA USEEIO, NAF/SIC division for ADEME spend ratios), or
 * the candidates with every industry-priced factor removed.
 */
export function pickIndustry<T extends Pick<EmissionFactor, "activityType">>(candidates: T[], industryCode: string | null | undefined): IndustryPick<T> {
  const naicsFactors = candidates.filter(isNaicsFactor);
  const nafFactors = candidates.filter(isNafFactor);
  const ukSicFactors = candidates.filter(isUkSicFactor);
  if (!naicsFactors.length && !nafFactors.length && !ukSicFactors.length) return { kind: "not_applicable", candidates };
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
  const sic = ukSicDigits(industryCode);
  if (ukSicFactors.length && sic) {
    const hit = ukSicMatch(ukSicFactors, sic);
    if (hit) return { kind: "matched", factor: hit, code: hit.activityType!.replace(UKSIC_ACTIVITY, "$1"), scheme: "UK SIC" };
  }
  if (naicsFactors.length) return { kind: "excluded", candidates: rest, code: naics, scheme: "NAICS" };
  if (nafFactors.length) return { kind: "excluded", candidates: rest, code: division, scheme: "NAF" };
  return { kind: "excluded", candidates: rest, code: sic, scheme: "UK SIC" };
}

/** Warning for a spend record that could not use its library's industry-priced factors. */
export function industryMissingWarning(scheme: IndustryScheme, code: string | null): string {
  if (scheme === "UK SIC") {
    return code
      ? `No UK spend multiplier covers SIC ${code}. Give the supplier's full SIC 2007 class (e.g. 41.20 or 41201); a 2-digit division only matches when one group covers all of it.`
      : "This library prices spend by industry. Add the supplier's UK SIC 2007 code (industry code, e.g. 41.20) to the record to use it.";
  }
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
