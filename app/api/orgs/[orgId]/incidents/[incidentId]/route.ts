export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import {
  updateIncidentSchema,
  createCorrectiveActionSchema,
} from "@/lib/validation/environment";
import {
  canCloseIncident,
  deriveActionStatus,
  assessNotificationTimeliness,
} from "@/lib/environment/incidents";

type Params = { params: Promise<{ orgId: string; incidentId: string }> };

const MANAGE_ROLES = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "editor",
  "reviewer",
] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, incidentId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const incident = await prisma.environmentalIncident.findFirst({
      where: { id: incidentId, organizationId: orgId },
      include: {
        facility: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        permit: { select: { id: true, reference: true, title: true } },
        owner: { select: { name: true, email: true } },
        reportedBy: { select: { name: true, email: true } },
        actions: {
          orderBy: { createdAt: "asc" },
          include: {
            assignedTo: { select: { name: true, email: true } },
            verifiedBy: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!incident) return apiError("NOT_FOUND", "Incident not found.", 404);

    const now = new Date();
    const actions = incident.actions.map((a) => ({
      ...a,
      status: deriveActionStatus(a, now),
    }));

    return Response.json({
      ...incident,
      estimatedQuantity:
        incident.estimatedQuantity === null ? null : Number(incident.estimatedQuantity),
      actions,
      closure: canCloseIncident({ ...incident, actions }),
      notification: assessNotificationTimeliness({ ...incident, now }),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, incidentId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const existing = await prisma.environmentalIncident.findFirst({
      where: { id: incidentId, organizationId: orgId },
      include: { actions: { select: { status: true } } },
    });
    if (!existing) return apiError("NOT_FOUND", "Incident not found.", 404);

    const body = updateIncidentSchema.parse(await req.json());

    // Closing an incident that still has open actions, no recorded root cause,
    // or an unreported notifiable event is the commonest way a register stops
    // meaning anything. This is a hard gate, not a warning.
    if (body.status === "closed" && existing.status !== "closed") {
      const merged = {
        rootCause: body.rootCause !== undefined ? body.rootCause : existing.rootCause,
        regulatorNotifiable:
          body.regulatorNotifiable !== undefined
            ? body.regulatorNotifiable
            : existing.regulatorNotifiable,
        regulatorNotifiedAt:
          body.regulatorNotifiedAt !== undefined
            ? body.regulatorNotifiedAt
            : existing.regulatorNotifiedAt,
        actions: existing.actions,
      };
      const check = canCloseIncident(merged);
      if (!check.canClose) {
        return apiError(
          "CANNOT_CLOSE",
          `This incident cannot be closed yet. ${check.reasons.join(" ")}`,
          422,
        );
      }
    }

    const newlyNotified =
      body.regulatorNotifiedAt != null && existing.regulatorNotifiedAt == null;

    const incident = await prisma.environmentalIncident.update({
      where: { id: incidentId },
      data: {
        ...(body.type !== undefined && { type: body.type }),
        ...(body.severity !== undefined && { severity: body.severity }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.discoveredAt !== undefined && { discoveredAt: body.discoveredAt ?? null }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.immediateAction !== undefined && {
          immediateAction: body.immediateAction ?? null,
        }),
        ...(body.rootCause !== undefined && { rootCause: body.rootCause ?? null }),
        ...(body.affectedMedium !== undefined && { affectedMedium: body.affectedMedium ?? null }),
        ...(body.estimatedQuantity !== undefined && {
          estimatedQuantity: body.estimatedQuantity ?? null,
        }),
        ...(body.quantityUnit !== undefined && { quantityUnit: body.quantityUnit ?? null }),
        ...(body.regulatorNotifiable !== undefined && {
          regulatorNotifiable: body.regulatorNotifiable,
        }),
        ...(body.regulatorNotifiedAt !== undefined && {
          regulatorNotifiedAt: body.regulatorNotifiedAt ?? null,
        }),
        ...(body.regulatorReference !== undefined && {
          regulatorReference: body.regulatorReference ?? null,
        }),
        ...(body.ownerUserId !== undefined && { ownerUserId: body.ownerUserId ?? null }),
        ...(body.status === "closed" && { closedAt: new Date() }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: body.status === "closed" ? "incident.closed" : "incident.updated",
      resourceType: "EnvironmentalIncident",
      resourceId: incident.id,
      metadata: { reference: incident.reference, changedFields: Object.keys(body) },
    });

    if (newlyNotified) {
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "incident.regulator_notified",
        resourceType: "EnvironmentalIncident",
        resourceId: incident.id,
        metadata: {
          reference: incident.reference,
          notifiedAt: incident.regulatorNotifiedAt?.toISOString() ?? null,
          regulatorReference: incident.regulatorReference,
        },
      });
    }

    return Response.json({
      ...incident,
      estimatedQuantity:
        incident.estimatedQuantity === null ? null : Number(incident.estimatedQuantity),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Adds a containment, corrective or preventive action to the incident. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, incidentId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const incident = await prisma.environmentalIncident.findFirst({
      where: { id: incidentId, organizationId: orgId },
      select: { id: true, reference: true, status: true },
    });
    if (!incident) return apiError("NOT_FOUND", "Incident not found.", 404);

    if (incident.status === "closed") {
      return apiError(
        "INCIDENT_CLOSED",
        "Reopen the incident before adding further actions to it.",
        409,
      );
    }

    const body = createCorrectiveActionSchema.parse(await req.json());

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

    const action = await prisma.correctiveAction.create({
      data: {
        organizationId: orgId,
        incidentId,
        type: body.type,
        description: body.description,
        assignedToUserId: body.assignedToUserId ?? null,
        dueOn: body.dueOn ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "corrective_action.created",
      resourceType: "CorrectiveAction",
      resourceId: action.id,
      metadata: {
        incidentReference: incident.reference,
        type: action.type,
        dueOn: action.dueOn?.toISOString() ?? null,
      },
    });

    return Response.json(action, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
