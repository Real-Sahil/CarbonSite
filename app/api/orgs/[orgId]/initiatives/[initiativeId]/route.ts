import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; initiativeId: string }> },
) {
  try {
    const { orgId, initiativeId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const initiative = await prisma.reductionInitiative.findUnique({
      where: { id: initiativeId },
      select: { id: true, organizationId: true, name: true },
    });

    if (!initiative || initiative.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Initiative not found.", 404);
    }

    await prisma.reductionInitiative.delete({ where: { id: initiativeId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "initiative.deleted",
      resourceType: "reduction_initiative",
      resourceId: initiativeId,
      metadata: { name: initiative.name },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
