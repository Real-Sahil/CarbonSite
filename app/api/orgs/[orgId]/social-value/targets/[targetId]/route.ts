export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; targetId: string }> },
) {
  try {
    const { orgId, targetId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "sustainability_manager", "contract_manager",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-targets-delete", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const target = await prisma.socialValueTarget.findUnique({ where: { id: targetId } });
    if (!target || target.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Social value target not found.", 404);
    }

    await prisma.socialValueTarget.delete({ where: { id: targetId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "social_value_target.deleted",
      resourceType: "social_value_target",
      resourceId: targetId,
      metadata: { contractId: target.contractId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
