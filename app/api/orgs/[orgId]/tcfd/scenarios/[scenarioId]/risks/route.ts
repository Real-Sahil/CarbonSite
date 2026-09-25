export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const CreateRiskSchema = z.object({
  riskCategory: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  financialImpactLow: z.number().nonnegative().optional(),
  financialImpactHigh: z.number().nonnegative().optional(),
  adaptationActions: z.string().max(3000).optional(),
  residualLikelihood: z.number().int().min(1).max(5).optional(),
  residualImpact: z.number().int().min(1).max(5).optional(),
  reviewDate: z.string().datetime().optional(),
  ownerUserId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; scenarioId: string }> },
) {
  try {
    const { orgId, scenarioId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const scenario = await prisma.tcfdScenario.findFirst({
      where: { id: scenarioId, organizationId: orgId },
    });
    if (!scenario) return apiError("NOT_FOUND", "Scenario not found", 404);

    const body = CreateRiskSchema.parse(await req.json());

    if (body.ownerUserId) {
      const owner = await prisma.organizationMembership.findFirst({
        where: { userId: body.ownerUserId, organizationId: orgId },
        select: { id: true },
      });
      if (!owner) return apiError("NOT_FOUND", "Owner is not a member of this organisation.", 404);
    }

    const risk = await prisma.tcfdRiskAssessment.create({
      data: {
        organizationId: orgId,
        scenarioId,
        riskCategory: body.riskCategory,
        description: body.description,
        likelihood: body.likelihood,
        impact: body.impact,
        financialImpactLow: body.financialImpactLow,
        financialImpactHigh: body.financialImpactHigh,
        adaptationActions: body.adaptationActions,
        residualLikelihood: body.residualLikelihood,
        residualImpact: body.residualImpact,
        reviewDate: body.reviewDate ? new Date(body.reviewDate) : undefined,
        ownerUserId: body.ownerUserId,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "tcfd.risk_created",
      resourceType: "TcfdRiskAssessment",
      resourceId: risk.id,
      metadata: { scenarioId, riskCategory: body.riskCategory },
    });

    return NextResponse.json({ risk }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
