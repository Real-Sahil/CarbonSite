export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteLinkId: string }> },
) {
  try {
    const { orgId, inviteLinkId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const link = await prisma.inviteLink.findUnique({
      where: { id: inviteLinkId },
    });

    if (!link || link.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Invite link not found.", 404);
    }

    if (link.usedAt !== null) {
      return apiError("INVITE_ALREADY_USED", "Cannot revoke an already accepted invite.", 400);
    }

    await prisma.inviteLink.delete({ where: { id: inviteLinkId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.member.invite",
      resourceType: "invite_link",
      resourceId: inviteLinkId,
      metadata: { action: "revoked", role: link.role, email: link.email },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
