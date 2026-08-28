/**
 * POST /api/orgs/[orgId]/anomalies/detect
 * Detect anomalies in a batch of activity records
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { detectAnomaliesInBatch } from "@/lib/ml/anomaly-detector";

const DetectAnomaliesRequest = z.object({
  recordIds: z.array(z.string()).min(1).max(100),
});

type DetectAnomaliesRequest = z.infer<typeof DetectAnomaliesRequest>;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Authorize
    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    // Parse request
    const body = await req.json();
    const { recordIds } = DetectAnomaliesRequest.parse(body);

    // Run anomaly detection
    const result = await detectAnomaliesInBatch(orgId, recordIds);

    return NextResponse.json({
      code: "ok",
      data: result,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
