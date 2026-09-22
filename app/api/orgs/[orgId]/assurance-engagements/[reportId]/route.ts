export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { isLockedStatus } from "@/lib/structured-forms/workflows";
import {
  EDIT_ROLES, contentFields, lockedError, optionalDate, toDate, toJson,
} from "@/lib/structured-forms/server";

const PatchSchema = z.object({
  ...contentFields,
  engagementDate: optionalDate,
}).strict();

type Params = { params: Promise<{ orgId: string; reportId: string }> };

// Content only. Status changes go through /api/orgs/[orgId]/assurance/engagements/[engagementId] so its guards apply.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, ...EDIT_ROLES);

    const existing = await prisma.assuranceEngagement.findFirst({
      where: { id: reportId, organizationId: orgId },
      select: { status: true },
    });
    if (!existing) return apiError("NOT_FOUND", "Assurance engagement not found.", 404);
    if (isLockedStatus("assurance-engagements", existing.status)) return lockedError("engagement");

    const body = PatchSchema.parse(await req.json());
    const updated = await prisma.assuranceEngagement.update({
      where: { id: reportId },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() || null }),
        ...(body.engagementDate !== undefined && { plannedStartDate: toDate(body.engagementDate) }),
        ...(body.sectionsJson !== undefined && { sectionsJson: toJson(body.sectionsJson) }),
      },
      select: { id: true, version: true, updatedAt: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance_engagement.updated",
      resourceType: "AssuranceEngagement",
      resourceId: reportId,
      metadata: { changedFields: Object.keys(body) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
