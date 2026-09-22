export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateSvCommitmentSchema } from "@/lib/validation/org";
import { Decimal } from "@prisma/client/runtime/library";

type RouteContext = { params: Promise<{ orgId: string; commitmentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, commitmentId } = await params;
    await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager",
      "contract_manager", "editor", "reviewer", "viewer", "auditor",
    );

    const commitment = await prisma.svCommitment.findUnique({
      where: { id: commitmentId },
      include: {
        contract: { select: { id: true, name: true, clientName: true } },
        framework: { select: { id: true, name: true, slug: true } },
        owner: { select: { id: true, name: true, email: true } },
        reportingPeriod: { select: { id: true, label: true, startDate: true, endDate: true } },
        activities: {
          orderBy: { activityDate: "desc" },
          take: 10,
          select: {
            id: true, title: true, activityDate: true,
            status: true, quantityValue: true, quantityUnit: true, monetisedValue: true,
          },
        },
        _count: { select: { activities: true } },
      },
    });

    if (!commitment || commitment.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Commitment not found.", 404);
    }

    return NextResponse.json(commitment);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, commitmentId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager", "contract_manager",
    );

    const commitment = await prisma.svCommitment.findUnique({ where: { id: commitmentId } });
    if (!commitment || commitment.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Commitment not found.", 404);
    }

    const body = updateSvCommitmentSchema.parse(await req.json());

    const updated = await prisma.svCommitment.update({
      where: { id: commitmentId },
      data: {
        ...body,
        targetValue: body.targetValue != null ? new Decimal(body.targetValue) : undefined,
        monetisedValue: body.monetisedValue != null ? new Decimal(body.monetisedValue) : undefined,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_commitment.update",
      resourceType: "SvCommitment",
      resourceId: commitmentId,
      metadata: body,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, commitmentId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin", "sustainability_director",
    );

    const commitment = await prisma.svCommitment.findUnique({
      where: { id: commitmentId },
      include: { _count: { select: { activities: true } } },
    });
    if (!commitment || commitment.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Commitment not found.", 404);
    }
    if (commitment._count.activities > 0) {
      return apiError("CONFLICT", "Cannot delete commitment with recorded activities.", 409);
    }

    await prisma.svCommitment.delete({ where: { id: commitmentId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_commitment.delete",
      resourceType: "SvCommitment",
      resourceId: commitmentId,
      metadata: { title: commitment.title },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
