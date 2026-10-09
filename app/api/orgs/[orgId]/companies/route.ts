export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError } from "@/lib/validation/api";
import { companiesReply } from "@/lib/geo/companies-lookup";

// GET /api/orgs/[orgId]/companies?q=name  -> candidates to choose from
// GET /api/orgs/[orgId]/companies?number=00453791[&owners=1] -> that company: address, SIC codes, flags, SME hint
// People who may edit suppliers, entities, subcontractors, plans and waste documents. Never guesses between companies.
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS, "sustainability_director", "sustainability_manager", "contract_manager");
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "companies-lookup", session.user.id), limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    return await companiesReply(req.nextUrl.searchParams);
  } catch (err) {
    return handleRouteError(err);
  }
}
