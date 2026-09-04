export const dynamic = "force-dynamic";

// Recording a monitoring visit against the 30 year obligation.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { completeMonitoringSchema } from "@/lib/validation/ecology";

type Params = { params: Promise<{ orgId: string; eventId: string }> };

const MANAGE_ROLES = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "project_manager",
  "editor",
] as const;

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, eventId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const event = await prisma.ecologicalMonitoringEvent.findFirst({
      where: { id: eventId, organizationId: orgId },
      include: { managementPlan: { select: { id: true, title: true } } },
    });
    if (!event) return apiError("NOT_FOUND", "Monitoring event not found.", 404);
    if (event.status === "completed" || event.status === "waived") {
      return apiError("ALREADY_RESOLVED", "This monitoring visit is already recorded.", 409);
    }

    const body = completeMonitoringSchema.parse(await req.json());

    // Habitat found off track triggers remediation rather than closing the
    // visit clean. The whole point of 30 year monitoring is catching failure
    // in time to fix it, so an off-track result stays open.
    const status = body.onTrack ? "completed" : "remediation_required";

    if (!body.onTrack && !body.remedialAction?.trim()) {
      return apiError(
        "REMEDIATION_REQUIRED",
        "Habitat recorded as off track needs a remedial action. The management plan's remediation strategy sets out what is expected.",
        422,
      );
    }

    const updated = await prisma.ecologicalMonitoringEvent.update({
      where: { id: eventId },
      data: {
        status,
        completedOn: body.completedOn,
        surveyorName: body.surveyorName ?? null,
        conditionFound: body.conditionFound ?? null,
        onTrack: body.onTrack,
        findings: body.findings ?? null,
        remedialAction: body.remedialAction ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "biodiversity.monitoring_completed",
      resourceType: "EcologicalMonitoringEvent",
      resourceId: updated.id,
      metadata: {
        managementPlan: event.managementPlan.title,
        monitoringYear: updated.monitoringYear,
        onTrack: body.onTrack,
        conditionFound: body.conditionFound ?? null,
      },
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
