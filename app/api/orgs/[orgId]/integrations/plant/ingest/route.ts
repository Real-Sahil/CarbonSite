export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/auth/api-key";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { ingestTelematics } from "@/lib/plant/ingest";
import { telematicsBody } from "@/lib/plant/schemas";

type Params = { params: Promise<{ orgId: string }> };

/**
 * Plant telematics push: an ISO 15143-3 (AEMP 2.0) fleet snapshot or period
 * rows, with an org API key. Readings are monitoring data for the Plant page,
 * not inventory records.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    let keyOrgId: string;
    try {
      keyOrgId = await validateApiKey(req.headers.get("authorization"));
    } catch {
      return apiError("UNAUTHORIZED", "Send a valid API key as 'Authorization: Bearer csk_...'.", 401);
    }
    if (keyOrgId !== orgId) return apiError("FORBIDDEN", "This API key belongs to a different organisation.", 403);

    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "ingest-plant", "api-key"), limit: 30, windowMs: 60_000 });
    if (limited) return limited;

    const raw = await req.json().catch(() => null);
    if (raw === null) return apiError("BAD_REQUEST", "The request body must be JSON.", 400);
    const body = telematicsBody.parse(raw);
    const result = await ingestTelematics(
      orgId,
      body.format === "iso15143" ? { kind: "iso15143", snapshot: body.snapshot } : { kind: "rows", rows: body.rows },
      body.format,
      null,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
