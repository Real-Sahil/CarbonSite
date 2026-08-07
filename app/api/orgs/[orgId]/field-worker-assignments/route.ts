import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isMissingDatabaseObjectError } from "@/lib/db/prisma-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createFieldWorkerAssignmentSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const assignments = await prisma.fieldWorkerAssignment.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        reportingPeriod: { select: { id: true, label: true, startDate: true, endDate: true } },
        facility: { select: { id: true, name: true } },
        assignedBy: { select: { name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json(assignments);
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "field-worker-assignments", session.user.id),
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createFieldWorkerAssignmentSchema.parse(await req.json());
    const [membership, reportingPeriod, facility] = await Promise.all([
      prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: body.userId,
          },
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.reportingPeriod.findFirst({
        where: { id: body.reportingPeriodId, organizationId: orgId },
        select: { id: true, label: true },
      }),
      body.facilityId
        ? prisma.facility.findFirst({
            where: { id: body.facilityId, organizationId: orgId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
    ]);

    if (!membership) {
      return apiError("FIELD_WORKER_NOT_FOUND", "This user is not a member of the organisation.", 404);
    }
    if (membership.role !== "field_worker") {
      return apiError(
        "NOT_FIELD_WORKER",
        "Only members with the Field Worker role can be assigned to mobile projects.",
        422,
      );
    }
    if (!reportingPeriod) {
      return apiError("INVALID_REPORTING_PERIOD", "Reporting period does not belong to this organisation.", 422);
    }
    if (body.facilityId && !facility) {
      return apiError("INVALID_FACILITY", "Facility does not belong to this organisation.", 422);
    }

    const assignment = await prisma.fieldWorkerAssignment.upsert({
      where: {
        organizationId_userId_reportingPeriodId: {
          organizationId: orgId,
          userId: body.userId,
          reportingPeriodId: body.reportingPeriodId,
        },
      },
      update: {
        facilityId: body.facilityId ?? null,
        assignedByUserId: session.user.id,
      },
      create: {
        organizationId: orgId,
        userId: body.userId,
        reportingPeriodId: body.reportingPeriodId,
        facilityId: body.facilityId,
        assignedByUserId: session.user.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        reportingPeriod: { select: { id: true, label: true, startDate: true, endDate: true } },
        facility: { select: { id: true, name: true } },
        assignedBy: { select: { name: true, email: true } },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_worker.assignment_created",
      resourceType: "field_worker_assignment",
      resourceId: assignment.id,
      metadata: {
        userId: assignment.userId,
        reportingPeriodId: assignment.reportingPeriodId,
        facilityId: assignment.facilityId,
      },
    });

    return NextResponse.json(assignment, { status: 201 });
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
