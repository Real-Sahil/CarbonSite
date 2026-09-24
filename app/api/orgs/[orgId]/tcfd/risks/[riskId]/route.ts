export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const UpdateRiskSchema = z.object({
  riskCategory: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(2000).optional(),
  likelihood: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  financialImpactLow: z.number().nonnegative().nullish(),
  financialImpactHigh: z.number().nonnegative().nullish(),
  adaptationActions: z.string().max(3000).nullish(),
  residualLikelihood: z.number().int().min(1).max(5).nullish(),
  residualImpact: z.number().int().min(1).max(5).nullish(),
  reviewDate: z.string().datetime().nullish(),
  ownerUserId: z.string().nullish(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; riskId: string }> },
) {
  try {
    const { orgId, riskId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const existing = await prisma.tcfdRiskAssessment.findFirst({
      where: { id: riskId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Risk not found", 404);

    const body = UpdateRiskSchema.parse(await req.json());

    const risk = await prisma.tcfdRiskAssessment.update({
      where: { id: riskId },
      data: {
        ...body,
        reviewDate: body.reviewDate ? new Date(body.reviewDate) : body.reviewDate,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "tcfd.risk_updated",
      resourceType: "TcfdRiskAssessment",
      resourceId: riskId,
      metadata: { changes: Object.keys(body) },
    });

    return NextResponse.json({ risk });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; riskId: string }> },
) {
  try {
    const { orgId, riskId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const existing = await prisma.tcfdRiskAssessment.findFirst({
      where: { id: riskId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Risk not found", 404);

    await prisma.tcfdRiskAssessment.delete({ where: { id: riskId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "tcfd.risk_deleted",
      resourceType: "TcfdRiskAssessment",
      resourceId: riskId,
      metadata: { scenarioId: existing.scenarioId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
