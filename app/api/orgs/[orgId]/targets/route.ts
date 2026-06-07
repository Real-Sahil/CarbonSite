import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createReductionTargetSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const targets = await prisma.reductionTarget.findMany({
      where: { organizationId: orgId },
      include: {
        baselinePeriod: { select: { id: true, label: true } },
        targetPeriod: { select: { id: true, label: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(targets);
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
    const body = createReductionTargetSchema.parse(await req.json());

    const periodCount = await prisma.reportingPeriod.count({
      where: {
        organizationId: orgId,
        id: { in: [body.baselinePeriodId, body.targetPeriodId] },
      },
    });

    if (periodCount !== 2) {
      return apiError(
        "INVALID_REPORTING_PERIOD",
        "Both reporting periods must belong to this organisation.",
        422,
      );
    }

    const target = await prisma.reductionTarget.create({
      data: {
        organizationId: orgId,
        baselinePeriodId: body.baselinePeriodId,
        targetPeriodId: body.targetPeriodId,
        targetType: body.targetType,
        reductionAmount: body.reductionAmount,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "target.created",
      resourceType: "reduction_target",
      resourceId: target.id,
      metadata: {
        targetType: target.targetType,
        reductionAmount: target.reductionAmount.toString(),
      },
    });

    return NextResponse.json(target, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
