export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { isLockedStatus } from "@/lib/structured-forms/workflows";
import {
  EDIT_ROLES, checkOrgRefs, contentFields, lockedError, optionalDate, toDate, toJson,
} from "@/lib/structured-forms/server";

const PatchSchema = z.object({
  ...contentFields,
  incidentDate: optionalDate,
}).strict();

type Params = { params: Promise<{ orgId: string; reportId: string }> };

// Content only. Status changes go through /api/orgs/[orgId]/incidents/[incidentId] so its guards apply.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, ...EDIT_ROLES);

    const existing = await prisma.environmentalIncident.findFirst({
      where: { id: reportId, organizationId: orgId },
      select: { status: true },
    });
    if (!existing) return apiError("NOT_FOUND", "Environmental incident not found.", 404);
    if (isLockedStatus("environmental-incidents", existing.status)) return lockedError("incident");

    const body = PatchSchema.parse(await req.json());
    const refError = await checkOrgRefs(orgId, { projectId: body.projectId, siteId: body.siteId });
    if (refError) return refError;
    const updated = await prisma.environmentalIncident.update({
      where: { id: reportId },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() || null }),
        ...(body.projectId !== undefined && { projectId: body.projectId }),
        ...(body.siteId !== undefined && { siteId: body.siteId }),
        ...(body.incidentDate && { occurredAt: toDate(body.incidentDate) as Date }),
        ...(body.sectionsJson !== undefined && { sectionsJson: toJson(body.sectionsJson) }),
      },
      select: { id: true, version: true, updatedAt: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "environmental_incident.updated",
      resourceType: "EnvironmentalIncident",
      resourceId: reportId,
      metadata: { changedFields: Object.keys(body) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
