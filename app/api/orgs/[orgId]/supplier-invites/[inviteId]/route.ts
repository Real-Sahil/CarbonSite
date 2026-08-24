export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

// DELETE /api/orgs/[orgId]/supplier-invites/[inviteId] — revoke pending invite (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> },
) {
  try {
    const { orgId, inviteId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const invite = await prisma.supplierInvite.findUnique({
      where: { id: inviteId },
      select: { organizationId: true, email: true, usedAt: true },
    });

    if (!invite || invite.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Supplier invite not found.", 404);
    }

    if (invite.usedAt !== null) {
      return apiError(
        "INVITE_ALREADY_USED",
        "Cannot revoke a supplier invite that has already been accepted.",
        409,
      );
    }

    await prisma.supplierInvite.delete({ where: { id: inviteId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "supplier_invite.revoked",
      resourceType: "SupplierInvite",
      resourceId: inviteId,
      metadata: { email: invite.email },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
