/**
 * GET /api/orgs/[orgId]/facilities/[facilityId]/anomalies
 * Get anomalies and quality metrics for a specific facility
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { detectFacilityTrendAnomalies, detectDuplicateRecords } from "@/lib/ml/anomaly-detector";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; facilityId: string }> }
) {
  try {
    const { orgId, facilityId } = await params;
    const timeWindow = parseInt(req.nextUrl.searchParams.get("timeWindow") || "90");

    // Authorize
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    // Run trend anomaly detection
    const trendAnomalies = await detectFacilityTrendAnomalies(orgId, facilityId, timeWindow);

    // Run duplicate detection
    const duplicates = await detectDuplicateRecords(orgId, facilityId, 5);

    return NextResponse.json({
      code: "ok",
      data: {
        trendAnomalies,
        duplicates,
        summary: {
          dataQuality: trendAnomalies.overallQuality,
          hasDuplicates: duplicates.length > 0,
          duplicateCount: duplicates.length,
        },
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
