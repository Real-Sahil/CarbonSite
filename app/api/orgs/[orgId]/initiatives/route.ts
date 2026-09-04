export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createInitiativeSchema } from "@/lib/validation/records";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const initiatives = await prisma.reductionInitiative.findMany({
      where: { organizationId: orgId },
      include: {
        owner: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
        facility: { select: { id: true, name: true } },
        emissionCategory: { select: { id: true, code: true, name: true } },
        reductionTarget: { select: { id: true, targetType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ data: initiatives });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = createInitiativeSchema.parse(await req.json());

    // Verify owner is a member of this org if specified
    if (body.ownerUserId) {
      const membership = await prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: body.ownerUserId } },
        select: { id: true },
      });
      if (!membership) {
        return apiError("NOT_FOUND", "Owner is not a member of this organisation.", 404);
      }
    }

    if (body.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: body.facilityId, organizationId: orgId },
        select: { id: true },
      });
      if (!facility) return apiError("NOT_FOUND", "Facility not found in this organisation.", 404);
    }

    if (body.emissionCategoryId) {
      const category = await prisma.emissionCategory.findUnique({
        where: { id: body.emissionCategoryId },
        select: { id: true },
      });
      if (!category) return apiError("NOT_FOUND", "Emission category not found.", 404);
    }

    if (body.reductionTargetId) {
      const target = await prisma.reductionTarget.findFirst({
        where: { id: body.reductionTargetId, organizationId: orgId },
        select: { id: true },
      });
      if (!target) return apiError("NOT_FOUND", "Reduction target not found in this organisation.", 404);
    }

    const initiative = await prisma.reductionInitiative.create({
      data: {
        organizationId: orgId,
        name: body.name,
        status: body.status,
        ownerUserId: body.ownerUserId,
        costAmount: body.costAmount,
        costCurrency: body.costCurrency,
        capexAmount: body.capexAmount,
        opexDeltaAnnual: body.opexDeltaAnnual,
        lifetimeYears: body.lifetimeYears,
        expectedImpactCo2e: body.expectedImpactCo2e,
        expectedStartDate: body.expectedStartDate ? new Date(body.expectedStartDate) : undefined,
        facilityId: body.facilityId,
        emissionCategoryId: body.emissionCategoryId,
        reductionTargetId: body.reductionTargetId,
        notes: body.notes,
        createdByUserId: session.user.id,
      },
      include: {
        owner: { select: { name: true, email: true } },
        facility: { select: { id: true, name: true } },
        emissionCategory: { select: { id: true, code: true, name: true } },
        reductionTarget: { select: { id: true, targetType: true } },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "initiative.created",
      resourceType: "reduction_initiative",
      resourceId: initiative.id,
      metadata: { name: initiative.name, status: initiative.status },
    });

    return NextResponse.json(initiative, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
