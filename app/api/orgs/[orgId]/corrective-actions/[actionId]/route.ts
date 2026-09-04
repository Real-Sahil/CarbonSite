export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateCorrectiveActionSchema } from "@/lib/validation/environment";

type Params = { params: Promise<{ orgId: string; actionId: string }> };

const MANAGE_ROLES = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "editor",
  "reviewer",
] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, actionId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const existing = await prisma.correctiveAction.findFirst({
      where: { id: actionId, organizationId: orgId },
      include: { incident: { select: { reference: true } } },
    });
    if (!existing) return apiError("NOT_FOUND", "Corrective action not found.", 404);

    const body = updateCorrectiveActionSchema.parse(await req.json());

    // Verification is a second pair of eyes. The person who did the work
    // cannot be the person who confirms it worked, which is the whole point of
    // the verification step in a CAPA process.
    if (body.status === "verified") {
      if (existing.assignedToUserId === session.user.id) {
        return apiError(
          "SELF_VERIFICATION",
          "A corrective action must be verified by someone other than the person it was assigned to.",
          403,
        );
      }
      if (existing.status === "open") {
        return apiError(
          "NOT_COMPLETED",
          "Mark the action complete before verifying it.",
          422,
        );
      }
    }

    if (body.assignedToUserId) {
      const member = await prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId: body.assignedToUserId },
        },
        select: { userId: true },
      });
      if (!member) {
        return apiError("NOT_FOUND", "Assignee is not a member of this organisation.", 404);
      }
    }

    const completing =
      body.status === "awaiting_verification" && existing.completedAt === null;

    const action = await prisma.correctiveAction.update({
      where: { id: actionId },
      data: {
        ...(body.type !== undefined && { type: body.type }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.assignedToUserId !== undefined && {
          assignedToUserId: body.assignedToUserId ?? null,
        }),
        ...(body.dueOn !== undefined && { dueOn: body.dueOn ?? null }),
        ...(completing && { completedAt: new Date() }),
        ...(body.status === "verified" && {
          verifiedByUserId: session.user.id,
          verifiedAt: new Date(),
          completedAt: existing.completedAt ?? new Date(),
          verificationNote: body.verificationNote ?? null,
        }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: body.status === "verified" ? "corrective_action.verified" : "corrective_action.updated",
      resourceType: "CorrectiveAction",
      resourceId: action.id,
      metadata: {
        incidentReference: existing.incident.reference,
        status: action.status,
        changedFields: Object.keys(body),
      },
    });

    return Response.json(action);
  } catch (err) {
    return handleRouteError(err);
  }
}
