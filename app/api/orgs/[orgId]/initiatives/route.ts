import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createReductionInitiativeSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const initiatives = await prisma.reductionInitiative.findMany({
      where: { organizationId: orgId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(initiatives);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const body = createReductionInitiativeSchema.parse(await req.json());

    if (body.ownerUserId) {
      const owner = await prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: body.ownerUserId,
          },
        },
      });

      if (!owner) {
        return apiError(
          "INVALID_OWNER",
          "The initiative owner must be a member of this organisation.",
          422,
        );
      }
    }

    const initiative = await prisma.reductionInitiative.create({
      data: {
        organizationId: orgId,
        name: body.name,
        ownerUserId: body.ownerUserId,
        status: body.status,
        costAmount: body.costAmount,
        costCurrency: body.costAmount ? body.costCurrency : undefined,
        expectedImpactCo2e: body.expectedImpactCo2e,
        expectedStartDate: body.expectedStartDate
          ? new Date(body.expectedStartDate)
          : undefined,
        notes: body.notes,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "initiative.created",
      resourceType: "reduction_initiative",
      resourceId: initiative.id,
      metadata: {
        name: initiative.name,
        status: initiative.status,
      },
    });

    return NextResponse.json(initiative, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
