export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createIncidentSchema } from "@/lib/validation/environment";
import {
  defaultRegulatorNotifiable,
  nextIncidentReference,
  summariseIncidentRegister,
  assessNotificationTimeliness,
  deriveActionStatus,
  notificationTargetHours,
} from "@/lib/environment/incidents";

type Params = { params: Promise<{ orgId: string }> };

// Anyone who works on site can report an incident. Restricting reporting is
// how registers end up under-recording, so the write gate here is deliberately
// wide and the review gate sits on closure instead.
const REPORT_ROLES = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "editor",
  "reviewer",
  "contract_manager",
  "project_manager",
  "site_manager",
  "supervisor",
] as const;

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");

    const incidents = await prisma.environmentalIncident.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as never } : {}),
        ...(severity ? { severity: severity as never } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: {
        facility: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        permit: { select: { id: true, reference: true } },
        owner: { select: { name: true, email: true } },
        reportedBy: { select: { name: true, email: true } },
        actions: {
          orderBy: { dueOn: "asc" },
          select: {
            id: true,
            type: true,
            description: true,
            status: true,
            dueOn: true,
            completedAt: true,
            verifiedAt: true,
            assignedTo: { select: { name: true, email: true } },
          },
        },
      },
    });

    const now = new Date();

    return Response.json({
      data: incidents.map((incident) => {
        const timeliness = assessNotificationTimeliness({ ...incident, now });
        return {
          ...incident,
          estimatedQuantity:
            incident.estimatedQuantity === null ? null : Number(incident.estimatedQuantity),
          notificationOverdue: timeliness.isOverdue,
          notificationTargetHours: timeliness.targetHours,
          hoursSinceDiscovery: Math.round(timeliness.hoursElapsed),
          actions: incident.actions.map((a) => ({
            ...a,
            status: deriveActionStatus(a, now),
          })),
        };
      }),
      summary: summariseIncidentRegister(incidents, now),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...REPORT_ROLES);

    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "incidents", session.user.id),
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createIncidentSchema.parse(await req.json());

    for (const [field, table] of [
      ["facilityId", "facility"],
      ["siteId", "site"],
      ["projectId", "project"],
      ["permitId", "environmentalPermit"],
    ] as const) {
      const id = body[field];
      if (!id) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = await (prisma as any)[table].findFirst({
        where: { id, organizationId: orgId },
        select: { id: true },
      });
      if (!found) {
        return apiError("NOT_FOUND", `Referenced ${table} not found in this organisation.`, 404);
      }
    }

    // Notifiability defaults from type and severity so a major incident cannot
    // be logged with the flag quietly off. An explicit true always wins; an
    // explicit false cannot lower a severity that is notifiable by default.
    const derivedNotifiable = defaultRegulatorNotifiable(body.type, body.severity);
    const regulatorNotifiable = body.regulatorNotifiable === true || derivedNotifiable;

    const existingRefs = await prisma.environmentalIncident.findMany({
      where: { organizationId: orgId },
      select: { reference: true },
    });

    const incident = await prisma.environmentalIncident.create({
      data: {
        organizationId: orgId,
        reference: nextIncidentReference(existingRefs.map((r) => r.reference)),
        type: body.type,
        severity: body.severity,
        occurredAt: body.occurredAt,
        discoveredAt: body.discoveredAt ?? null,
        facilityId: body.facilityId ?? null,
        siteId: body.siteId ?? null,
        projectId: body.projectId ?? null,
        permitId: body.permitId ?? null,
        description: body.description,
        immediateAction: body.immediateAction ?? null,
        affectedMedium: body.affectedMedium ?? null,
        estimatedQuantity: body.estimatedQuantity ?? null,
        quantityUnit: body.quantityUnit ?? null,
        regulatorNotifiable,
        reportedByUserId: session.user.id,
        ownerUserId: body.ownerUserId ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "incident.reported",
      resourceType: "EnvironmentalIncident",
      resourceId: incident.id,
      metadata: {
        reference: incident.reference,
        type: incident.type,
        severity: incident.severity,
        regulatorNotifiable,
      },
    });

    return Response.json(
      {
        ...incident,
        estimatedQuantity:
          incident.estimatedQuantity === null ? null : Number(incident.estimatedQuantity),
        notificationTargetHours: notificationTargetHours(incident.severity),
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
