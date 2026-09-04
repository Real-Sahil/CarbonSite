export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateCarbonBudgetPhaseSchema } from "@/lib/validation/project-carbon";

type Params = {
  params: Promise<{ orgId: string; contractId: string; projectId: string; phaseId: string }>;
};

async function findScopedPhase(orgId: string, projectId: string, phaseId: string) {
  return prisma.carbonBudgetPhase.findFirst({
    where: {
      id: phaseId,
      budget: { organizationId: orgId, projectId },
    },
  });
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, projectId, phaseId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const phase = await findScopedPhase(orgId, projectId, phaseId);
    if (!phase) return apiError("NOT_FOUND", "Carbon budget phase not found.", 404);

    return NextResponse.json({ phase });
  } catch (err) {
    return handleRouteError(err);
  }
}

// Records manually reconciled progress (actualTco2e, percentComplete) —
// there is no automatic data link from a phase to specific activity
// records, so a project/site manager records this the same way physical
// percent complete is recorded on a cost-based earned value system.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, projectId, phaseId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);

    const existing = await findScopedPhase(orgId, projectId, phaseId);
    if (!existing) return apiError("NOT_FOUND", "Carbon budget phase not found.", 404);

    const body = await req.json().catch(() => null);
    const parsed = updateCarbonBudgetPhaseSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid carbon budget phase data.", 400, parsed.error.flatten());
    }

    const phase = await prisma.carbonBudgetPhase.update({
      where: { id: phaseId },
      data: parsed.data,
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "carbon_budget.phase_updated",
      resourceType: "CarbonBudgetPhase",
      resourceId: phaseId,
      metadata: { changes: parsed.data },
    });

    return NextResponse.json({ phase });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, projectId, phaseId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);

    const existing = await findScopedPhase(orgId, projectId, phaseId);
    if (!existing) return apiError("NOT_FOUND", "Carbon budget phase not found.", 404);

    await prisma.carbonBudgetPhase.delete({ where: { id: phaseId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "carbon_budget.phase_deleted",
      resourceType: "CarbonBudgetPhase",
      resourceId: phaseId,
      metadata: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
