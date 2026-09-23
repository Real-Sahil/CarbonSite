export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { PAS2080_EDITORS } from "@/lib/pas2080/roles";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { opportunityProblem, opportunitySchema } from "@/lib/pas2080";

type Params = { params: Promise<{ orgId: string; contractId: string; projectId: string }> };

const DECIDED = new Set(["adopted", "implemented", "rejected"]);

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, ...PAS2080_EDITORS);
    const project = await prisma.project.findFirst({ where: { id: projectId, contractId, organizationId: orgId }, select: { id: true } });
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const body = opportunitySchema.parse(await req.json());
    const problem = opportunityProblem(body);
    if (problem) return apiError("RATIONALE_REQUIRED", problem, 422);

    const opportunity = await prisma.carbonReductionOpportunity.create({
      data: {
        organizationId: orgId,
        projectId,
        title: body.title,
        description: body.description || null,
        hierarchyLevel: body.hierarchyLevel,
        workStage: body.workStage || null,
        lifecycleModules: body.lifecycleModules,
        estimatedSavingTco2e: body.estimatedSavingTco2e ?? null,
        status: body.status,
        decisionRationale: body.decisionRationale || null,
        ownerName: body.ownerName || null,
        decidedAt: DECIDED.has(body.status) ? new Date() : null,
        createdByUserId: session.user.id,
      },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "pas2080.opportunity_created",
      resourceType: "carbon_reduction_opportunity",
      resourceId: opportunity.id,
      metadata: { projectId, hierarchyLevel: body.hierarchyLevel, status: body.status },
    });
    return NextResponse.json(opportunity, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
