/**
 * POST /api/orgs/:orgId/facilities/:facilityId/enrich
 *
 * Triggers EA and Natural England spatial lookups for a facility and
 * writes the results back to the Facility record. Requires a lat/lng to
 * be set on the facility (returns 422 if missing).
 *
 * Roles allowed: admin, editor (enrichment mutates facility data).
 * Field workers cannot trigger enrichment.
 *
 * This is an on-demand admin operation — not called on every request.
 * It is idempotent: repeated calls update the same columns in place.
 * The `eaEnrichmentLastRunAt` column records when it was last run.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { getFloodRiskAtPoint } from "@/lib/data-sources/ea-flood-monitoring";
import { getWaterBodyAtPoint } from "@/lib/data-sources/ea-catchment-planning";
import { getDesignationsNearPoint } from "@/lib/data-sources/natural-england-arcgis";
import { getNearbyAurnStations } from "@/lib/data-sources/uk-air";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; facilityId: string }> },
) {
  try {
    const { orgId, facilityId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const facility = await prisma.facility.findFirst({
      where: { id: facilityId, organizationId: orgId },
      select: { id: true, latitude: true, longitude: true, name: true },
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
    const [floodResult, waterBodyResult, designationsResult, aurnResult] =
      await Promise.allSettled([
        getFloodRiskAtPoint(lat, lng),
        getWaterBodyAtPoint(lat, lng),
        getDesignationsNearPoint(lat, lng, 2000),
        getNearbyAurnStations(lat, lng, 20),
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

    await prisma.facility.update({
      where: { id: facilityId },
      data: patch,
    });

    const errors: string[] = [];
    if (floodResult.status === "rejected") errors.push(`flood: ${floodResult.reason}`);
    if (waterBodyResult.status === "rejected") errors.push(`waterBody: ${waterBodyResult.reason}`);
    if (designationsResult.status === "rejected") errors.push(`designations: ${designationsResult.reason}`);
    if (aurnResult.status === "rejected") errors.push(`aurn: ${aurnResult.reason}`);

    return NextResponse.json({
      facilityId,
      updatedAt: patch.eaEnrichmentLastRunAt,
      fieldsUpdated: Object.keys(patch).filter((k) => k !== "eaEnrichmentLastRunAt"),
      lookupErrors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
