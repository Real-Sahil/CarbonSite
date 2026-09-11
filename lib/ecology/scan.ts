/**
 * Ecology scan orchestrator.
 * Geocodes a UK postcode, then fans out to NBN Atlas + MAGIC + Forestry Commission.
 * Writes results directly to an existing EcologicalScan row (must be created first).
 */

import { prisma } from "@/lib/db";
import { scanSpecies } from "@/lib/data-sources/nbn-atlas";
import { scanDesignatedSitesAndWoodland } from "@/lib/data-sources/magic";

interface PostcodeResult {
  result: {
    latitude: number;
    longitude: number;
  } | null;
}

async function geocodePostcode(postcode: string): Promise<{ lat: number; lon: number }> {
  const normalised = postcode.replace(/\s+/g, "").toUpperCase();
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(normalised)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Postcode lookup failed: ${res.status}`);
  const data: PostcodeResult = await res.json();
  if (!data.result) throw new Error(`Postcode not found: ${postcode}`);
  return { lat: data.result.latitude, lon: data.result.longitude };
}

export async function runEcologicalScan(scanId: string): Promise<void> {
  const scan = await prisma.ecologicalScan.findUnique({
    where: { id: scanId },
    select: { id: true, postcode: true, radiusKm: true },
  });
  if (!scan) throw new Error(`EcologicalScan ${scanId} not found`);

  await prisma.ecologicalScan.update({
    where: { id: scanId },
    data: { status: "running" },
  });

  try {
    const { lat, lon } = await geocodePostcode(scan.postcode);
    const radiusKm = Number(scan.radiusKm);

    const [speciesResult, magicResult] = await Promise.all([
      scanSpecies(lat, lon, radiusKm),
      scanDesignatedSitesAndWoodland(lat, lon, Math.max(radiusKm, 5)),
    ]);

    await prisma.ecologicalScan.update({
      where: { id: scanId },
      data: {
        status: "completed",
        scannedAt: new Date(),

        totalSpeciesCount:    speciesResult.totalSpeciesCount,
        plantSpeciesCount:    speciesResult.plantSpeciesCount,
        birdSpeciesCount:     speciesResult.birdSpeciesCount,
        mammalSpeciesCount:   speciesResult.mammalSpeciesCount,
        invertSpeciesCount:   speciesResult.invertSpeciesCount,
        reptileSpeciesCount:  speciesResult.reptileSpeciesCount,
        amphibianSpeciesCount: speciesResult.amphibianSpeciesCount,
        otherSpeciesCount:    speciesResult.otherSpeciesCount,
        speciesRecords:       speciesResult.speciesRecords as unknown as import("@prisma/client").Prisma.InputJsonValue,

        designatedSites:     magicResult.designatedSites as unknown as import("@prisma/client").Prisma.InputJsonValue,
        sssiCount:           magicResult.sssiCount,
        sacCount:            magicResult.sacCount,
        spaCount:            magicResult.spaCount,
        nvrCount:            magicResult.nvrCount,
        ancientWoodlandCount: magicResult.ancientWoodlandCount,

        woodlandData:        magicResult.woodlandData as unknown as import("@prisma/client").Prisma.InputJsonValue,
        woodlandTotalHa:     magicResult.woodlandTotalHa,
        broadleafHa:         magicResult.broadleafHa,
        coniferHa:           magicResult.coniferHa,
        mixedWoodlandHa:     magicResult.mixedWoodlandHa,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.ecologicalScan.update({
      where: { id: scanId },
      data: { status: "failed", errorMessage: msg },
    });
    throw err;
  }
}
