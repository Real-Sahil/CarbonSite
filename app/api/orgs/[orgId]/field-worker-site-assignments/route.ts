import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isMissingDatabaseObjectError } from "@/lib/db/prisma-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";

// FieldWorkerSiteAssignment is what the mobile app's /my-sites reads — this
// endpoint is how admins grant field workers access to sites after onboarding
// (site-scoped invite links create the first assignment automatically).

const createSchema = z.object({
  userId: z.string().min(1),
  siteId: z.string().min(1),
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const assignments = await prisma.fieldWorkerSiteAssignment.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        site: {
          select: {
            id: true,
            name: true,
            project: { select: { name: true } },
          },
        },
        assignedBy: { select: { name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json(assignments);
  } catch (err) {
    if (isMissingDatabaseObjectError(err)) {
      return apiError(
        "ASSIGNMENTS_MIGRATION_PENDING",
        "Site assignments are not ready yet. Apply the latest Prisma migration.",
        503,
      );
    }
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "field-worker-site-assignments", session.user.id),
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createSchema.parse(await req.json());

    const [membership, site] = await Promise.all([
      prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId: body.userId },
        },
        select: { role: true },
      }),
      prisma.site.findFirst({
        where: { id: body.siteId, organizationId: orgId },
        select: { id: true },
      }),
    ]);

    if (!membership) {
      return apiError("FIELD_WORKER_NOT_FOUND", "This user is not a member of the organisation.", 404);
    }
    if (membership.role !== "field_worker") {
      return apiError(
        "NOT_FIELD_WORKER",
        "Only members with the Field Worker role can be assigned to sites.",
        422,
      );
    }
    if (!site) {
      return apiError("INVALID_SITE", "Site does not belong to this organisation.", 422);
    }

    const assignment = await prisma.fieldWorkerSiteAssignment.upsert({
      where: {
        organizationId_userId_siteId: {
          organizationId: orgId,
          userId: body.userId,
          siteId: body.siteId,
        },
      },
      update: { assignedByUserId: session.user.id },
      create: {
        organizationId: orgId,
        userId: body.userId,
        siteId: body.siteId,
        assignedByUserId: session.user.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        site: {
          select: {
            id: true,
            name: true,
            project: { select: { name: true } },
          },
        },
        assignedBy: { select: { name: true, email: true } },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_worker.site_assigned",
      resourceType: "field_worker_site_assignment",
      resourceId: assignment.id,
      metadata: { userId: assignment.userId, siteId: assignment.siteId },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    if (isMissingDatabaseObjectError(err)) {
      return apiError(
        "ASSIGNMENTS_MIGRATION_PENDING",
        "Site assignments are not ready yet. Apply the latest Prisma migration.",
        503,
      );
    }
    return handleRouteError(err);
  }
}
