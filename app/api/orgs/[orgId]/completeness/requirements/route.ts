export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createCompletenessRequirementSchema } from "@/lib/validation/completeness";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const requirements = await prisma.dataCompletenessRequirement.findMany({
      where: { organizationId: orgId, emissionCategoryId: { not: null } },
      include: {
        facility: { select: { id: true, name: true } },
        emissionCategory: { select: { id: true, code: true, name: true, scope: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ facility: { name: "asc" } }],
    });

    return NextResponse.json({ requirements });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const body = await req.json().catch(() => null);
    const parsed = createCompletenessRequirementSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid completeness requirement.", 400, parsed.error.flatten());
    }
    const data = parsed.data;

    const [facility, category] = await Promise.all([
      prisma.facility.findFirst({ where: { id: data.facilityId, organizationId: orgId } }),
      prisma.emissionCategory.findUnique({ where: { id: data.emissionCategoryId } }),
    ]);
    if (!facility) return apiError("NOT_FOUND", "Facility not found.", 404);
    if (!category) return apiError("NOT_FOUND", "Emission category not found.", 404);

    if (data.ownerUserId) {
      const membership = await prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: data.ownerUserId } },
      });
      if (!membership) return apiError("NOT_FOUND", "Owner is not a member of this organisation.", 404);
    }

    const requirement = await prisma.dataCompletenessRequirement.upsert({
      where: {
        organizationId_facilityId_emissionCategoryId: {
          organizationId: orgId,
          facilityId: data.facilityId,
          emissionCategoryId: data.emissionCategoryId,
        },
      },
      create: {
        organizationId: orgId,
        facilityId: data.facilityId,
        emissionCategoryId: data.emissionCategoryId,
        ownerUserId: data.ownerUserId,
        required: data.required,
        notes: data.notes,
      },
      update: {
        ownerUserId: data.ownerUserId,
        required: data.required,
        notes: data.notes,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "completeness.requirement_set",
      resourceType: "DataCompletenessRequirement",
      resourceId: requirement.id,
      metadata: { facilityId: data.facilityId, emissionCategoryId: data.emissionCategoryId, required: data.required },
    });

    return NextResponse.json({ requirement }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
