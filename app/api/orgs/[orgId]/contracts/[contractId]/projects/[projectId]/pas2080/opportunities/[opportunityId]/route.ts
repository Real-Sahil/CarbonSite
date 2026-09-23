export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { PAS2080_EDITORS } from "@/lib/pas2080/roles";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { opportunityProblem, opportunitySchema } from "@/lib/pas2080";

type Params = { params: Promise<{ orgId: string; contractId: string; projectId: string; opportunityId: string }> };

const DECIDED = new Set(["adopted", "implemented", "rejected"]);

async function findOpportunity(orgId: string, contractId: string, projectId: string, opportunityId: string) {
  return prisma.carbonReductionOpportunity.findFirst({
    where: { id: opportunityId, organizationId: orgId, projectId, project: { contractId } },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId, opportunityId } = await params;
    const { session } = await requireOrgMember(orgId, ...PAS2080_EDITORS);
    const existing = await findOpportunity(orgId, contractId, projectId, opportunityId);
    if (!existing) return apiError("NOT_FOUND", "Opportunity not found.", 404);

    const body = opportunitySchema.partial().parse(await req.json());
    const merged = { status: body.status ?? existing.status, decisionRationale: body.decisionRationale !== undefined ? body.decisionRationale : existing.decisionRationale };
    const problem = opportunityProblem(merged);
    if (problem) return apiError("RATIONALE_REQUIRED", problem, 422);

    const statusChanged = body.status !== undefined && body.status !== existing.status;
    const updated = await prisma.carbonReductionOpportunity.update({
      where: { id: existing.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.hierarchyLevel !== undefined ? { hierarchyLevel: body.hierarchyLevel } : {}),
        ...(body.workStage !== undefined ? { workStage: body.workStage || null } : {}),
        ...(body.lifecycleModules !== undefined ? { lifecycleModules: body.lifecycleModules } : {}),
        ...(body.estimatedSavingTco2e !== undefined ? { estimatedSavingTco2e: body.estimatedSavingTco2e } : {}),
        ...(body.decisionRationale !== undefined ? { decisionRationale: body.decisionRationale || null } : {}),
        ...(body.ownerName !== undefined ? { ownerName: body.ownerName || null } : {}),
        ...(statusChanged ? { status: body.status, decidedAt: DECIDED.has(body.status!) ? new Date() : null } : {}),
      },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "pas2080.opportunity_updated",
      resourceType: "carbon_reduction_opportunity",
      resourceId: existing.id,
      metadata: { projectId, ...(statusChanged ? { from: existing.status, to: body.status } : {}) },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId, opportunityId } = await params;
    const { session } = await requireOrgMember(orgId, ...PAS2080_EDITORS);
    const existing = await findOpportunity(orgId, contractId, projectId, opportunityId);
    if (!existing) return apiError("NOT_FOUND", "Opportunity not found.", 404);
    // Decisions are part of the carbon management record; only undecided entries can be removed.
    if (DECIDED.has(existing.status)) {
      return apiError("OPPORTUNITY_DECIDED", "A decided opportunity stays on the log. Change its status instead.", 409);
    }
    await prisma.carbonReductionOpportunity.delete({ where: { id: existing.id } });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "pas2080.opportunity_deleted",
      resourceType: "carbon_reduction_opportunity",
      resourceId: existing.id,
      metadata: { projectId, title: existing.title },
    });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
