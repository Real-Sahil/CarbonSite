export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { requireFeature } from "@/lib/billing/limits";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError } from "@/lib/validation/api";
import { installPpn026, PPN026_VERSION } from "@/lib/social-value/ppn026";

/** Adds the PPN 026 Social Value Model to the organisation's frameworks. Idempotent. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager", "contract_manager");
    const planGate = await requireFeature(orgId, "socialValue");
    if (planGate) return planGate;
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-ppn026-install", session.user.id),
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const result = await prisma.$transaction((tx) => installPpn026(tx, orgId));
    if (result.created) {
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "sv_framework.create",
        resourceType: "SvFramework",
        resourceId: result.id,
        metadata: { template: "ppn-026", version: PPN026_VERSION },
      });
    }
    return NextResponse.json({ id: result.id, created: result.created }, { status: result.created ? 201 : 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
