export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; targetId: string }> },
) {
  try {
    const { orgId, targetId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const target = await prisma.reductionTarget.findUnique({
      where: { id: targetId },
      select: { id: true, organizationId: true, targetType: true },
    });

    if (!target || target.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Target not found.", 404);
    }

    await prisma.reductionTarget.delete({ where: { id: targetId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "target.deleted",
      resourceType: "reduction_target",
      resourceId: targetId,
      metadata: { targetType: target.targetType },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
