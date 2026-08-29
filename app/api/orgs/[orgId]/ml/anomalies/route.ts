import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { detectAnomaliesInBatch, detectFacilityTrendAnomalies } from "@/lib/ml/anomaly-detector";

interface Params {
  orgId: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "viewer", "reviewer", "editor", "auditor");

    const body = await req.json();
    const { recordIds, facilityId, timeWindowDays } = body as {
      recordIds?: string[];
      facilityId?: string;
      timeWindowDays?: number;
    };

    let result;

    if (recordIds && recordIds.length > 0) {
      result = await detectAnomaliesInBatch(orgId, recordIds);
    } else if (facilityId) {
      result = await detectFacilityTrendAnomalies(orgId, facilityId, timeWindowDays || 90);
    } else {
      return NextResponse.json(
        { error: "Either recordIds or facilityId must be provided" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
