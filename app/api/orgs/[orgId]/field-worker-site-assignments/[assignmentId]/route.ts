import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; assignmentId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, assignmentId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const assignment = await prisma.fieldWorkerSiteAssignment.findFirst({
      where: { id: assignmentId, organizationId: orgId },
      select: { id: true, userId: true, siteId: true },
    });
    if (!assignment) {
      return apiError("NOT_FOUND", "Assignment not found.", 404);
    }

    await prisma.fieldWorkerSiteAssignment.delete({ where: { id: assignment.id } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_worker.site_unassigned",
      resourceType: "field_worker_site_assignment",
      resourceId: assignment.id,
      metadata: { userId: assignment.userId, siteId: assignment.siteId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
