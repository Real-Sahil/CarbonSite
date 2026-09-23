// Industry codes for spend-based factors. EPA USEEIO v1.3 publishes one
// factor per 6-digit NAICS code (activityType "naics_<code>"); a spend record
// names its supplier's code in ActivityRecord.industryCode. Without a code,
// NAICS factors are never picked: 1016 equally good candidates would
// otherwise fall to the id tie-break and price all spend as the first
// industry in the list.

import type { EmissionFactor } from "@prisma/client";

const NAICS_ACTIVITY = /^naics_(\d{6})$/;

/** The 6-digit NAICS code in "236220", "NAICS 236220" or "naics_236220"; null otherwise. */
export function naicsCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(?:naics[\s_:-]*)?(\d{6})$/i);
  return m ? m[1] : null;
}

export const isNaicsFactor = (f: Pick<EmissionFactor, "activityType">) => NAICS_ACTIVITY.test(f.activityType ?? "");

export type NaicsPick<T> =
  | { kind: "matched"; factor: T; code: string }
  | { kind: "not_applicable"; candidates: T[] }
  | { kind: "excluded"; candidates: T[]; code: string | null };

/**
 * Among one category's candidates: the exact NAICS factor for the record's
 * code, or the candidates with every NAICS factor removed.
 */
export function pickNaics<T extends Pick<EmissionFactor, "activityType">>(candidates: T[], industryCode: string | null | undefined): NaicsPick<T> {
  if (!candidates.some(isNaicsFactor)) return { kind: "not_applicable", candidates };
  const code = naicsCode(industryCode);
  const exact = code ? candidates.find((f) => f.activityType === `naics_${code}`) : undefined;
  if (exact && code) return { kind: "matched", factor: exact, code };
  return { kind: "excluded", candidates: candidates.filter((f) => !isNaicsFactor(f)), code };
}

/** Warning for a spend record that could not use its library's NAICS factors. */
export function naicsMissingWarning(code: string | null): string {
  return code
    ? `No spend factor for NAICS ${code} in this library. Check the code (6 digits, 2017 NAICS).`
    : "This library prices spend by industry. Add the supplier's 6-digit NAICS code (industry code) to the record to use it.";
}

export const UNVERIFIED_FACTOR_WARNING =
  "The selected factor is marked Unverified (no traceable source or price year). Treat this figure as a rough estimate, or use a sourced factor.";

export const isUnverifiedFactor = (f: Pick<EmissionFactor, "usageNotes">) => (f.usageNotes ?? "").includes("Unverified:");
