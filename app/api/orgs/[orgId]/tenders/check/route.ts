export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/orgs/{orgId}/tenders/check: run this organisation's watch now. */
import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { TENDER_EDITORS } from "@/lib/tenders/fts";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { requireFeature } from "@/lib/billing/limits";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/db";
import { runTenderWatches } from "@/lib/tenders/watch";
import { FtsRateLimited } from "@/lib/tenders/fts";

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...TENDER_EDITORS);
    const gate = await requireFeature(orgId, "bidCarbonPack");
    if (gate) return gate;
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "tender-check", session.user.id), limit: 6, windowMs: 60 * 60_000 });
    if (limited) return limited;
    const watch = await prisma.tenderWatch.findUnique({ where: { organizationId: orgId }, select: { enabled: true } });
    if (!watch?.enabled) return apiError("NO_WATCH", "Save a tender watch first.", 409);
    let result;
    try {
      result = await runTenderWatches({ organizationId: orgId });
    } catch (err) {
      if (err instanceof FtsRateLimited) return apiError("FTS_RATE_LIMITED", `Find a Tender is busy. Try again in ${Math.ceil(err.retryAfterSeconds / 60)} minute(s); the daily check also runs every morning.`, 503);
      return apiError("FTS_UNAVAILABLE", "Find a Tender did not answer. Try again in a few minutes.", 502);
    }
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "tender.checked", resourceType: "TenderWatch", resourceId: orgId, metadata: result });
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
