export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateInitiativeSchema } from "@/lib/validation/records";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; initiativeId: string }> }) {
  try {
    const { orgId, initiativeId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const initiative = await prisma.reductionInitiative.findUnique({
      where: { id: initiativeId },
      select: { organizationId: true },
    });
    if (!initiative || initiative.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Initiative not found.", 404);
    }

    const body = updateInitiativeSchema.parse(await req.json());

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

    const updated = await prisma.reductionInitiative.update({
      where: { id: initiativeId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.ownerUserId !== undefined ? { ownerUserId: body.ownerUserId } : {}),
        ...(body.costAmount !== undefined ? { costAmount: body.costAmount } : {}),
        ...(body.costCurrency !== undefined ? { costCurrency: body.costCurrency } : {}),
        ...(body.capexAmount !== undefined ? { capexAmount: body.capexAmount } : {}),
        ...(body.opexDeltaAnnual !== undefined ? { opexDeltaAnnual: body.opexDeltaAnnual } : {}),
        ...(body.lifetimeYears !== undefined ? { lifetimeYears: body.lifetimeYears } : {}),
        ...(body.expectedImpactCo2e !== undefined ? { expectedImpactCo2e: body.expectedImpactCo2e } : {}),
        ...(body.facilityId !== undefined ? { facilityId: body.facilityId } : {}),
        ...(body.emissionCategoryId !== undefined ? { emissionCategoryId: body.emissionCategoryId } : {}),
        ...(body.reductionTargetId !== undefined ? { reductionTargetId: body.reductionTargetId } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "initiative.created",
      resourceType: "reduction_initiative",
      resourceId: initiativeId,
      metadata: { updated: Object.keys(body) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; initiativeId: string }> },
) {
  try {
    const { orgId, initiativeId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const initiative = await prisma.reductionInitiative.findUnique({
      where: { id: initiativeId },
      select: { id: true, organizationId: true, name: true },
    });

    if (!initiative || initiative.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Initiative not found.", 404);
    }

    await prisma.reductionInitiative.delete({ where: { id: initiativeId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "initiative.deleted",
      resourceType: "reduction_initiative",
      resourceId: initiativeId,
      metadata: { name: initiative.name },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
