export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { MS_EDITORS } from "@/lib/management-systems/access";

type Params = { params: Promise<{ orgId: string; id: string }> };

/** Revoke an auditor link at once. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const access = await prisma.msAuditorAccess.findFirst({ where: { id, organizationId: orgId } });
    if (!access) return apiError("NOT_FOUND", "That auditor link was not found.", 404);
    if (!access.revokedAt) await prisma.msAuditorAccess.update({ where: { id: access.id }, data: { revokedAt: new Date() } });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.auditor_access_revoked",
      resourceType: "MsAuditorAccess",
      resourceId: access.id,
      metadata: { name: access.name },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
