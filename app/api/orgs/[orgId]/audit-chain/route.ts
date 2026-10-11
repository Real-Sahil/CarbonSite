export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Checks the organisation's audit-trail hash chain end to end and reports the result. Read-only.

import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { verifyAuditChain } from "@/lib/db/audit";

type Params = { params: Promise<{ orgId: string }> };

/** The roles that may take the whole trail out in an assurance pack may check it. */
const ROLES = ["admin", "sustainability_director", "sustainability_manager", "reviewer", "auditor"] as const;

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLES);
    const limited = await rateLimitRequest(req, { key: `audit-chain:${orgId}:${session.user.id}`, limit: 10, windowMs: 60 * 60_000 });
    if (limited) return limited;
    return Response.json({ checkedAt: new Date().toISOString(), ...(await verifyAuditChain(orgId)) });
  } catch (err) {
    return handleRouteError(err);
  }
}
