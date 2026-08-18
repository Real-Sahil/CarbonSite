export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createTargetSchema } from "@/lib/validation/records";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const targets = await prisma.reductionTarget.findMany({
      where: { organizationId: orgId },
      include: {
        baselinePeriod: { select: { label: true } },
        targetPeriod: { select: { label: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: targets });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = createTargetSchema.parse(await req.json());

    // Verify both periods belong to this org
    const [baseline, targetPeriod] = await Promise.all([
      prisma.reportingPeriod.findUnique({
        where: { id: body.baselinePeriodId },
        select: { organizationId: true },
      }),
      prisma.reportingPeriod.findUnique({
        where: { id: body.targetPeriodId },
        select: { organizationId: true },
      }),
    ]);

    if (!baseline || baseline.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Baseline period not found.", 404);
    }
    if (!targetPeriod || targetPeriod.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Target period not found.", 404);
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
      include: {
        baselinePeriod: { select: { label: true } },
        targetPeriod: { select: { label: true } },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "target.created",
      resourceType: "reduction_target",
      resourceId: target.id,
      metadata: { targetType: target.targetType },
    });

    return NextResponse.json(target, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
