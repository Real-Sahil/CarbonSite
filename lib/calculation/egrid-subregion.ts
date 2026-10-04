// eGRID subregions. EPA publishes one grid factor per subregion (27 of them)
// beside the national average. A US record is priced with its subregion only
// when it names one: on the record's fuel/detail field ("eGRID CAMX") or, for
// the facility the record belongs to, in the facility's own eGRID subregion.
// Every other US electricity record uses the national average, so a state is
// never guessed (subregions cross state lines).

import type { EmissionFactor } from "@prisma/client";

export const EGRID_SUBREGIONS: { code: string; name: string }[] = [
  { code: "AKGD", name: "ASCC Alaska Grid" },
  { code: "AKMS", name: "ASCC Miscellaneous" },
  { code: "AZNM", name: "WECC Southwest" },
  { code: "CAMX", name: "WECC California" },
  { code: "ERCT", name: "ERCOT All" },
  { code: "FRCC", name: "FRCC All" },
  { code: "HIMS", name: "HICC Miscellaneous" },
  { code: "HIOA", name: "HICC Oahu" },
  { code: "MROE", name: "MRO East" },
  { code: "MROW", name: "MRO West" },
  { code: "NEWE", name: "NPCC New England" },
  { code: "NWPP", name: "WECC Northwest" },
  { code: "NYCW", name: "NPCC NYC/Westchester" },
  { code: "NYLI", name: "NPCC Long Island" },
  { code: "NYUP", name: "NPCC Upstate NY" },
  { code: "RFCE", name: "RFC East" },
  { code: "RFCM", name: "RFC Michigan" },
  { code: "RFCW", name: "RFC West" },
  { code: "RMPA", name: "WECC Rockies" },
  { code: "SPNO", name: "SPP North" },
  { code: "SPSO", name: "SPP South" },
  { code: "SRMV", name: "SERC Mississippi Valley" },
  { code: "SRMW", name: "SERC Midwest" },
  { code: "SRSO", name: "SERC South" },
  { code: "SRTV", name: "SERC Tennessee Valley" },
  { code: "SRVC", name: "SERC Virginia/Carolina" },
];

export const EGRID_CODES = new Set(EGRID_SUBREGIONS.map((s) => s.code));

const SUBREGION = /^egrid_([a-z]{4})$/;
export const isEgridFactor = (f: Pick<EmissionFactor, "activityType">) => SUBREGION.test(f.activityType ?? "");

/** The subregion code a hint names (case-insensitive, as a whole word), if any. */
export function subregionInHint(hint: string | null | undefined): string | null {
  for (const word of (hint ?? "").toUpperCase().split(/[^A-Z0-9]+/)) {
    if (EGRID_CODES.has(word)) return word;
  }
  return null;
}

export type SubregionPick<T> = { kind: "matched"; factor: T } | { kind: "rest"; candidates: T[] };

/**
 * The named subregion's factor, else the candidates without any subregion row.
 * `facilitySubregion` is the facility's own setting; a code on the record wins.
 */
export function pickEgridSubregion<T extends Pick<EmissionFactor, "activityType">>(
  candidates: T[],
  hint: string | null | undefined,
  facilitySubregion?: string | null,
): SubregionPick<T> {
  const subregions = candidates.filter(isEgridFactor);
  if (!subregions.length) return { kind: "rest", candidates };
  const code = subregionInHint(hint) ?? (facilitySubregion && EGRID_CODES.has(facilitySubregion) ? facilitySubregion : null);
  const named = code ? subregions.find((f) => f.activityType === `egrid_${code.toLowerCase()}`) : undefined;
  if (named) return { kind: "matched", factor: named };
  return { kind: "rest", candidates: candidates.filter((f) => !isEgridFactor(f)) };
}
