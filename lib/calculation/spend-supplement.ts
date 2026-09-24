// Spend priced by the supplier's industry when the run's library cannot.
//
// A run is pinned to one factor library (usually DEFRA or EPA activity
// factors). Those have no sourced spend factor per industry, so a spend
// record that names its supplier's industry code would fall back to a
// generic or Unverified spend factor. Instead it is priced from the sourced
// spend library for the record's currency, and only when that library has a
// factor for the exact industry:
//   GBP  Defra UK spend multipliers (UK SIC 2007 groups)
//   USD  EPA USEEIO 1.3 (NAICS-6)
//   EUR  ADEME Base Carbone (NAF division)
// The calculation's selection reason names the library, and reports credit
// every library a run's calculations used (lib/reports/attribution-load.ts).

import { prisma } from "@/lib/db";
import { buildFactorCache, type FactorCache, type FactorQuery, type FactorSelection } from "./factor-selector";
import { pickIndustry } from "./industry-code";

export const SPEND_LIBRARIES: Record<string, { name: string; version: string }> = {
  GBP: { name: "Defra UK spend multipliers", version: "2023" },
  USD: { name: "EPA USEEIO", version: "1.3" },
  EUR: { name: "ADEME Base Carbone", version: "2025.04" },
};

/**
 * The industry factor from the record currency's spend library, or null
 * (no library for the currency, the run already uses it, or no factor for the
 * code). `caches` holds each library's factors for the rest of the run.
 */
export async function selectSpendSupplement(
  recordUnit: string,
  runLibraryId: string,
  query: FactorQuery,
  caches: Map<string, FactorCache | null>,
): Promise<FactorSelection | null> {
  const spec = SPEND_LIBRARIES[recordUnit.trim().toUpperCase()];
  if (!spec || !query.industryCode) return null;
  const key = `${spec.name} ${spec.version}`;
  if (!caches.has(key)) {
    const lib = await prisma.factorLibrary.findUnique({ where: { name_version: { name: spec.name, version: spec.version } }, select: { id: true } });
    caches.set(key, lib && lib.id !== runLibraryId ? await buildFactorCache(lib.id) : null);
  }
  const cache = caches.get(key);
  if (!cache) return null;
  const libraryId = [...cache.values()][0]?.[0]?.factorLibraryId;
  if (!libraryId) return null;
  const bucket = (cache.get(`${libraryId}:${query.emissionCategoryId}`) ?? []).filter(
    (f) => (!f.effectiveStartDate || f.effectiveStartDate <= query.activityDate) && (!f.effectiveEndDate || f.effectiveEndDate >= query.activityDate),
  );
  const pick = pickIndustry(bucket, query.industryCode);
  if (pick.kind !== "matched") return null;
  return {
    factor: pick.factor,
    selectionReason: `${pick.scheme} ${pick.code} matched in ${key} (spend library for ${recordUnit.toUpperCase()})`,
    warnings: [],
  };
}
