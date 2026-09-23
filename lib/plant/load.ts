import { prisma } from "@/lib/db";
import { convertBetween, CUBIC_METRE_UNITS } from "@/lib/calculation/units";

const PLANT_FUEL = /diesel|hvo|gas ?oil|renewable|dery|derv/i;
import { chooseFactorLibrary, currentFactorLibraries } from "@/lib/calculation/library-for-period";
import { reconcileSites, summarisePlant, type PlantFactors } from "./analytics";

/** Diesel (average biofuel blend, as sold in the UK since red diesel ended for construction) and HVO, from the library for the window. */
async function plantFactors(to: Date): Promise<PlantFactors> {
  const libraries = currentFactorLibraries(await prisma.factorLibrary.findMany({ select: { id: true, name: true, version: true } }));
  const library = chooseFactorLibrary(libraries, to);
  if (!library) return null;
  const rows = await prisma.emissionFactor.findMany({
    where: { factorLibraryId: library.id, OR: [{ externalId: { endsWith: "-diesel-litre" } }, { externalId: { endsWith: "-hvo-litre" } }], inputUnit: "litre" },
    select: { externalId: true, co2e: true, biogenicCo2: true },
  });
  const pick = (suffix: string) => {
    const r = rows.find((x) => x.externalId?.endsWith(suffix) && x.co2e != null);
    return r ? { externalId: r.externalId!, kgCo2ePerLitre: Number(r.co2e), biogenicKgPerLitre: r.biogenicCo2 != null ? Number(r.biogenicCo2) : null } : null;
  };
  const diesel = pick("-diesel-litre");
  return diesel ? { diesel, hvo: pick("-hvo-litre"), library: `${library.name} ${library.version}` } : null;
}

export async function loadPlant(orgId: string, from: Date, to: Date) {
  const [assets, readings, factors] = await Promise.all([
    prisma.plantAsset.findMany({
      where: { organizationId: orgId },
      include: { site: { select: { id: true, name: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.plantTelematicsReading.findMany({
      where: { organizationId: orgId, periodEnd: { gt: from, lte: to } },
      select: { assetId: true, operatingHours: true, idleHours: true, fuelLitres: true, idleFuelLitres: true },
    }),
    plantFactors(to),
  ]);

  const siteIds = [...new Set(assets.map((a) => a.siteId).filter((s): s is string => !!s))];
  const recorded = siteIds.length
    ? await prisma.activityRecord.findMany({
        where: {
          organizationId: orgId,
          siteId: { in: siteIds },
          reviewStatus: "approved",
          emissionCategory: { scope: 1 },
          activityDate: { gt: from, lte: to },
        },
        select: { siteId: true, amount: true, unit: true, fuelType: true },
      })
    : [];
  const recordedBySite = new Map<string, number>();
  // Diesel and HVO measured in litres only: m3 also converts to litres in the
  // unit registry, and a gas meter reading is not plant fuel.
  for (const r of recorded) {
    if (CUBIC_METRE_UNITS.has(r.unit.toLowerCase().trim())) continue;
    if (!r.fuelType || !PLANT_FUEL.test(r.fuelType)) continue;
    const litres = convertBetween(Number(r.amount), r.unit, "litre");
    if (litres == null || !r.siteId) continue;
    recordedBySite.set(r.siteId, (recordedBySite.get(r.siteId) ?? 0) + litres);
  }

  const n = (d: { toString(): string } | null) => (d == null ? null : Number(d));
  const summary = summarisePlant(
    assets.map((a) => ({
      id: a.id, name: a.name, category: a.category, fuelType: a.fuelType, siteId: a.siteId,
      siteName: a.site?.name ?? null, ownership: a.ownership, autoRegistered: a.autoRegistered,
    })),
    readings.map((r) => ({
      assetId: r.assetId, operatingHours: n(r.operatingHours), idleHours: n(r.idleHours),
      fuelLitres: n(r.fuelLitres), idleFuelLitres: n(r.idleFuelLitres),
    })),
    factors,
  );
  const siteNames = new Map(assets.filter((a) => a.site).map((a) => [a.site!.id, a.site!.name]));
  return {
    ...summary,
    factors,
    reconciliation: reconcileSites(summary.assets, recordedBySite, siteNames),
    rawAssets: assets,
  };
}
