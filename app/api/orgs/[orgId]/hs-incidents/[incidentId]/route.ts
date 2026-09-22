export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const PatchSchema = z.object({
  status: z.enum(["reported", "investigating", "action_required", "closed"]).optional(),
  rootCause: z.string().optional().nullable(),
  immediateAction: z.string().optional().nullable(),
  lostTimeDays: z.number().int().min(0).optional(),
  riddorReportable: z.boolean().optional(),
  riddorReferenceNo: z.string().optional().nullable(),
  riddorNotifiedAt: z.string().datetime().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  methodStatementId: z.string().optional().nullable(),
  closedAt: z.string().datetime().optional().nullable(),
}).strict();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string; incidentId: string }> }) {
  try {
    const { orgId, incidentId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const incident = await prisma.hsIncidentReport.findUnique({
      where: { id: incidentId },
      include: {
        reportedBy: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
        facility: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        methodStatement: { select: { id: true, title: true, version: true } },
      },
    });

    if (!incident || incident.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Incident not found", 404);
    }

    return NextResponse.json(incident);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; incidentId: string }> }) {
  try {
    const { orgId, incidentId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const incident = await prisma.hsIncidentReport.findUnique({
      where: { id: incidentId },
      select: { organizationId: true, status: true },
    });
    if (!incident || incident.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Incident not found", 404);
    }

    const body = PatchSchema.parse(await req.json());
    const updated = await prisma.hsIncidentReport.update({
      where: { id: incidentId },
      data: {
        ...(body.status && { status: body.status as never }),
        ...(body.rootCause !== undefined && { rootCause: body.rootCause }),
        ...(body.immediateAction !== undefined && { immediateAction: body.immediateAction }),
        ...(body.lostTimeDays !== undefined && { lostTimeDays: body.lostTimeDays }),
        ...(body.riddorReportable !== undefined && { riddorReportable: body.riddorReportable }),
        ...(body.riddorReferenceNo !== undefined && { riddorReferenceNo: body.riddorReferenceNo }),
        ...(body.riddorNotifiedAt !== undefined && {
          riddorNotifiedAt: body.riddorNotifiedAt ? new Date(body.riddorNotifiedAt) : null,
        }),
        ...(body.ownerUserId !== undefined && { ownerUserId: body.ownerUserId }),
        ...(body.methodStatementId !== undefined && { methodStatementId: body.methodStatementId }),
        ...(body.closedAt !== undefined && { closedAt: body.closedAt ? new Date(body.closedAt) : null }),
      },
    });

    const action = body.status === "closed"
      ? "hs_incident.closed"
      : body.riddorNotifiedAt
      ? "hs_incident.riddor_notified"
      : "hs_incident.updated";

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action,
      resourceType: "HsIncidentReport",
      resourceId: incidentId,
      metadata: { patch: body },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ orgId: string; incidentId: string }> }) {
  try {
    const { orgId, incidentId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const incident = await prisma.hsIncidentReport.findUnique({
      where: { id: incidentId },
      select: { organizationId: true, reference: true },
    });
    if (!incident || incident.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Incident not found", 404);
    }

    await prisma.hsIncidentReport.delete({ where: { id: incidentId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "hs_incident.updated",
      resourceType: "HsIncidentReport",
      resourceId: incidentId,
      metadata: { deleted: true, reference: incident.reference },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
