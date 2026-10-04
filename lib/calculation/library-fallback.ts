// A run is pinned to one factor library. When that library has no factor at
// all for a record, the record used to be saved at 0 kg CO2e. For a US run on
// EPA, whose activity tables are narrower than DEFRA's, the record is instead
// priced from the next library that has one, and says so:
//   EPA -> the DEFRA set for the period (chooseFactorLibrary), then ADEME
// Never for grid electricity or purchased heat: those are national, and a UK
// or French grid factor on a US site would be wrong, not approximate. Never
// when the record already has an organisation factor. Only a factor whose unit
// can take the record's unit is used. DEFRA and ADEME runs have no fallback
// (a gap there stays a visible zero).
//
// The selection reason starts "fallback library" so the dashboard counts the
// kg CO2e priced this way as fallback, and the calculation carries a warning
// naming the library and, when the factor is another country's, that country.

import { prisma } from "@/lib/db";
import { buildFactorCache, selectFactor, type FactorCache, type FactorQuery, type FactorSelection } from "./factor-selector";
import { chooseFactorLibrary } from "./library-for-period";
import { areUnitsCompatible } from "./units";

const NATIONAL_CATEGORIES = new Set(["s2-electricity-lb", "s2-electricity-mb", "s2-heat"]);

type Lib = { id: string; name: string; version: string };

/** Libraries to try, in order, for a run pinned to `runLibrary`. */
export function fallbackOrder(runLibrary: { name: string }, all: Lib[], periodEnd: Date): Lib[] {
  if (runLibrary.name !== "EPA") return [];
  const defra = chooseFactorLibrary(all.filter((l) => l.name === "DEFRA"), periodEnd);
  const ademe = all
    .filter((l) => l.name === "ADEME Base Carbone")
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
  return [defra, ademe].filter((l): l is Lib => !!l);
}

export type FallbackState = { libraries: Lib[] | null; caches: Map<string, FactorCache> };
export const newFallbackState = (): FallbackState => ({ libraries: null, caches: new Map() });

export async function selectFallbackFactor(
  runLibrary: { id: string; name: string },
  categoryCode: string,
  query: FactorQuery,
  recordUnit: string,
  periodEnd: Date,
  state: FallbackState,
  recordCountry: string | null,
): Promise<FactorSelection | null> {
  if (runLibrary.name !== "EPA" || NATIONAL_CATEGORIES.has(categoryCode)) return null;
  state.libraries ??= await prisma.factorLibrary.findMany({ select: { id: true, name: true, version: true } });
  for (const lib of fallbackOrder(runLibrary, state.libraries, periodEnd)) {
    let cache = state.caches.get(lib.id);
    if (!cache) {
      cache = await buildFactorCache(lib.id);
      state.caches.set(lib.id, cache);
    }
    const pick = await selectFactor({ ...query, factorLibraryId: lib.id, industryCode: null }, cache);
    if (!pick) continue;
    const unit = pick.factor.inputUnit;
    if (unit !== recordUnit && !areUnitsCompatible(unit, recordUnit)) continue;
    const other = pick.factor.geographyCountry && pick.factor.geographyCountry !== recordCountry ? pick.factor.geographyCountry : null;
    return {
      factor: pick.factor,
      selectionReason: `fallback library ${lib.name} ${lib.version}: ${pick.selectionReason}`,
      warnings: [
        ...(pick.warnings ?? []),
        `${runLibrary.name} has no factor for this record, so ${lib.name} ${lib.version} was used instead` +
          (other ? ` (a ${other} factor, a proxy${recordCountry ? ` for ${recordCountry}` : ""} operations)` : "") +
          ". Check it suits the record, or add an organisation factor.",
      ],
    };
  }
  return null;
}
