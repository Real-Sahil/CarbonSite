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
  permitDate: optionalDate,
  expiryDate: optionalDate,
}).strict();

type Params = { params: Promise<{ orgId: string; reportId: string }> };

// Content only. Status changes go through /api/orgs/[orgId]/permits/[permitId] so its guards apply.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, ...EDIT_ROLES);

    const existing = await prisma.environmentalPermit.findFirst({
      where: { id: reportId, organizationId: orgId },
      select: { status: true },
    });
    if (!existing) return apiError("NOT_FOUND", "Environmental permit not found.", 404);
    if (isLockedStatus("environmental-permits", existing.status)) return lockedError("permit");

    const body = PatchSchema.parse(await req.json());
    const refError = await checkOrgRefs(orgId, { siteId: body.siteId });
    if (refError) return refError;
    const updated = await prisma.environmentalPermit.update({
      where: { id: reportId },
      data: {
        ...(body.title?.trim() && { title: body.title.trim() }),
        ...(body.siteId !== undefined && { siteId: body.siteId }),
        ...(body.permitDate !== undefined && { issuedOn: toDate(body.permitDate) }),
        ...(body.expiryDate !== undefined && { expiresOn: toDate(body.expiryDate) }),
        ...(body.sectionsJson !== undefined && { sectionsJson: toJson(body.sectionsJson) }),
      },
      select: { id: true, version: true, updatedAt: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "environmental_permit.updated",
      resourceType: "EnvironmentalPermit",
      resourceId: reportId,
      metadata: { changedFields: Object.keys(body) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
