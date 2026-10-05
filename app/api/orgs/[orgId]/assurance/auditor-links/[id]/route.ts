export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { LINK_ROLES } from "@/lib/assurance/auditor-link";

type Params = { params: Promise<{ orgId: string; id: string }> };

/** Withdraw a verifier link at once. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ROLES);
    const access = await prisma.inventoryAuditorAccess.findFirst({ where: { id, organizationId: orgId } });
    if (!access) return apiError("NOT_FOUND", "That link was not found.", 404);
    if (!access.revokedAt) await prisma.inventoryAuditorAccess.update({ where: { id: access.id }, data: { revokedAt: new Date() } });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.auditor_link_revoked",
      resourceType: "InventoryAuditorAccess",
      resourceId: access.id,
      metadata: { name: access.name },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
