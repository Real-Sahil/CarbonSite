export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateCompletenessRequirementSchema } from "@/lib/validation/completeness";

type Params = { params: Promise<{ orgId: string; requirementId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, requirementId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const existing = await prisma.dataCompletenessRequirement.findFirst({
      where: { id: requirementId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Completeness requirement not found.", 404);

    const body = await req.json().catch(() => null);
    const parsed = updateCompletenessRequirementSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid completeness requirement update.", 400, parsed.error.flatten());
    }
    const data = parsed.data;

    if (data.ownerUserId) {
      const membership = await prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: data.ownerUserId } },
      });
      if (!membership) return apiError("NOT_FOUND", "Owner is not a member of this organisation.", 404);
    }

    const requirement = await prisma.dataCompletenessRequirement.update({
      where: { id: requirementId },
      data,
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "completeness.requirement_set",
      resourceType: "DataCompletenessRequirement",
      resourceId: requirementId,
      metadata: { changes: data },
    });

    return NextResponse.json({ requirement });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, requirementId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const existing = await prisma.dataCompletenessRequirement.findFirst({
      where: { id: requirementId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Completeness requirement not found.", 404);

    await prisma.dataCompletenessRequirement.delete({ where: { id: requirementId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "completeness.requirement_deleted",
      resourceType: "DataCompletenessRequirement",
      resourceId: requirementId,
      metadata: {},
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
