export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; offsetId: string }> },
) {
  try {
    const { orgId, offsetId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const offset = await prisma.carbonOffset.findUnique({ where: { id: offsetId } });
    if (!offset || offset.organizationId !== orgId) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Offset not found" }, { status: 404 });
    }

    await prisma.carbonOffset.delete({ where: { id: offsetId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.deleted",
      resourceType: "carbon_offset",
      resourceId: offsetId,
      metadata: { projectName: offset.projectName },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
