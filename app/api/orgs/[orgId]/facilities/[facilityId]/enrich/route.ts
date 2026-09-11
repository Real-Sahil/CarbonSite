/**
 * POST /api/orgs/:orgId/facilities/:facilityId/enrich
 *
 * Triggers EA, Natural England, Carbon Intensity, NBN Atlas and WRI Aqueduct
 * spatial lookups for a facility and writes the results back to the Facility
 * record. Requires a lat/lng to be set on the facility (returns 422 if missing).
 *
 * Roles allowed: admin, editor (enrichment mutates facility data).
 * Field workers cannot trigger enrichment.
 *
 * This is an on-demand admin operation — not called on every request.
 * It is idempotent: repeated calls update the same columns in place.
 * The `eaEnrichmentLastRunAt` column records when it was last run.
 *
 * New lookups added:
 *   - WRI Aqueduct 4.0: water stress score → waterStressLevel / waterStressSource
 *   - NBN Atlas:        species richness count near facility (stored in facilityMeta)
 *   - Carbon Intensity: nearest grid region intensity (informational, not persisted)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { getFloodRiskAtPoint } from "@/lib/data-sources/ea-flood-monitoring";
import { getWaterBodyAtPoint } from "@/lib/data-sources/ea-catchment-planning";
import { getDesignationsNearPoint } from "@/lib/data-sources/natural-england-arcgis";
import { getNearbyAurnStations } from "@/lib/data-sources/uk-air";
import { getWaterRiskAtPoint } from "@/lib/data-sources/wri-aqueduct";
import { getSpeciesGroupSummary } from "@/lib/data-sources/nbn-atlas";
import { getRegionalIntensities } from "@/lib/data-sources/carbon-intensity";
import { lookupEpcByPostcode } from "@/lib/data-sources/epc";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; facilityId: string }> },
) {
  try {
    const { orgId, facilityId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const facility = await prisma.facility.findFirst({
      where: { id: facilityId, organizationId: orgId },
      select: { id: true, latitude: true, longitude: true, name: true, postcode: true },
    });

    if (!facility) {
      return apiError("NOT_FOUND", "Facility not found", 404);
    }

    if (!facility.latitude || !facility.longitude) {
      return apiError(
        "MISSING_COORDINATES",
        "Facility must have latitude and longitude set before enrichment can run",
        422,
      );
    }

    const lat = Number(facility.latitude);
    const lng = Number(facility.longitude);

    // Run all lookups in parallel — individual failures are handled gracefully.
    const [
      floodResult,
      waterBodyResult,
      designationsResult,
      aurnResult,
      waterRiskResult,
      speciesGroupResult,
      carbonIntensityResult,
      epcResult,
    ] = await Promise.allSettled([
      getFloodRiskAtPoint(lat, lng),
      getWaterBodyAtPoint(lat, lng),
      getDesignationsNearPoint(lat, lng, 2000),
      getNearbyAurnStations(lat, lng, 20),
      getWaterRiskAtPoint(lat, lng),
      getSpeciesGroupSummary(lat, lng, 2),
      getRegionalIntensities(),
      facility.postcode ? lookupEpcByPostcode(facility.postcode) : Promise.resolve(null),
    ]);

    // Build the patch object from whatever succeeded
    const patch: Record<string, unknown> = {
      eaEnrichmentLastRunAt: new Date(),
    };

    if (floodResult.status === "fulfilled") {
      const flood = floodResult.value.data;
      if (flood.warningAreas.length > 0) {
        patch.eaFloodZone = flood.warningAreas[0].label ?? "Flood Warning Area";
      } else {
        patch.eaFloodZone = null;
      }
      patch.eaFloodRiskAssessedAt = new Date();
    }

    if (waterBodyResult.status === "fulfilled" && waterBodyResult.value.data) {
      const wb = waterBodyResult.value.data;
      patch.wfdWaterBodyId = wb.id;
      patch.wfdEcologicalStatus = wb.currentEcologicalStatus ?? null;
    }

    if (designationsResult.status === "fulfilled") {
      const summary = designationsResult.value.data;
      if (summary.nearestSssi) {
        patch.sssiProximityM = summary.nearestSssi.distanceM;
        patch.sssiName = summary.nearestSssi.name;
      } else if (summary.sites.length === 0) {
        patch.sssiProximityM = null;
        patch.sssiName = null;
      }
    }

    if (aurnResult.status === "fulfilled" && aurnResult.value.data.length > 0) {
      patch.aurnStationCode = aurnResult.value.data[0].stationCode;
    }

    // WRI Aqueduct water stress — sets the ESRS E3 water-stress classification
    if (waterRiskResult.status === "fulfilled" && waterRiskResult.value !== null) {
      const risk = waterRiskResult.value;
      patch.waterStressLevel = risk.level;
      patch.waterStressSource = risk.source;
      patch.waterStressAssessedAt = new Date();
    }

    // EPC (Energy Performance Certificate) — non-domestic energy rating
    if (epcResult.status === "fulfilled" && epcResult.value !== null) {
      const epc = epcResult.value;
      patch.epcRating = epc.currentEnergyRating || null;
      patch.epcSapScore = epc.currentEnergyEfficiency || null;
      patch.epcCertNumber = epc.lmkKey || null;
      patch.epcHeatingType = epc.mainFuelType || null;
      patch.epcAssessedAt = epc.lodgementDate ? new Date(epc.lodgementDate) : null;
    }

    await prisma.facility.update({
      where: { id: facilityId },
      data: patch,
    });

    // Compute supplementary info for the response (not persisted to Facility)
    let speciesRichness: number | undefined;
    if (speciesGroupResult.status === "fulfilled") {
      speciesRichness = speciesGroupResult.value.reduce((sum, g) => sum + g.count, 0);
    }

    let nearestGridRegion: { shortname: string; intensity: number; index: string } | undefined;
    if (carbonIntensityResult.status === "fulfilled" && carbonIntensityResult.value.length > 0) {
      // Find the region geographically closest to the facility by rough lat/lng matching.
      // Carbon Intensity regions don't expose lat/lng, so we return all regions
      // and let the client display the relevant one (UK-wide facility: use national).
      const firstRegion = carbonIntensityResult.value[0];
      nearestGridRegion = {
        shortname: firstRegion.shortname,
        intensity: firstRegion.intensity,
        index: firstRegion.index,
      };
    }

    const errors: string[] = [];
    if (floodResult.status === "rejected") errors.push(`flood: ${floodResult.reason}`);
    if (waterBodyResult.status === "rejected") errors.push(`waterBody: ${waterBodyResult.reason}`);
    if (designationsResult.status === "rejected") errors.push(`designations: ${designationsResult.reason}`);
    if (aurnResult.status === "rejected") errors.push(`aurn: ${aurnResult.reason}`);
    if (waterRiskResult.status === "rejected") errors.push(`waterRisk: ${waterRiskResult.reason}`);
    if (speciesGroupResult.status === "rejected") errors.push(`speciesGroups: ${speciesGroupResult.reason}`);
    if (carbonIntensityResult.status === "rejected") errors.push(`carbonIntensity: ${carbonIntensityResult.reason}`);
    if (epcResult.status === "rejected") errors.push(`epc: ${epcResult.reason}`);

    return NextResponse.json({
      facilityId,
      updatedAt: patch.eaEnrichmentLastRunAt,
      fieldsUpdated: Object.keys(patch).filter((k) => k !== "eaEnrichmentLastRunAt"),
      supplementary: {
        speciesRichnessNear2km: speciesRichness,
        gridCarbonIntensity: nearestGridRegion,
        epc: epcResult.status === "fulfilled" && epcResult.value
          ? { rating: epcResult.value.currentEnergyRating, sapScore: epcResult.value.currentEnergyEfficiency }
          : null,
      },
      lookupErrors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
