export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isMissingDatabaseObjectError } from "@/lib/db/prisma-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; assignmentId: string }> },
) {
  try {
    const { orgId, assignmentId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const assignment = await prisma.fieldWorkerAssignment.findFirst({
      where: { id: assignmentId, organizationId: orgId },
    });
    if (!assignment) {
      return apiError("ASSIGNMENT_NOT_FOUND", "Field worker assignment was not found.", 404);
    }

    await prisma.fieldWorkerAssignment.delete({ where: { id: assignment.id } });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_worker.assignment_deleted",
      resourceType: "field_worker_assignment",
      resourceId: assignment.id,
      metadata: {
        userId: assignment.userId,
        reportingPeriodId: assignment.reportingPeriodId,
        facilityId: assignment.facilityId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (isMissingDatabaseObjectError(err)) {
      return apiError(
        "ASSIGNMENTS_MIGRATION_PENDING",
        "Mobile worker assignments are not ready yet. Apply the latest Prisma migration.",
        503,
      );
    }
    return handleRouteError(err);
  }
}
