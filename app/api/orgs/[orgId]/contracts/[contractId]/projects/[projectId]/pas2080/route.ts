export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { PAS2080_EDITORS } from "@/lib/pas2080/roles";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { planSchema } from "@/lib/pas2080";
import { loadPas2080 } from "@/lib/pas2080/load";

type Params = { params: Promise<{ orgId: string; contractId: string; projectId: string }> };

async function findProject(orgId: string, contractId: string, projectId: string) {
  return prisma.project.findFirst({ where: { id: projectId, contractId, organizationId: orgId }, select: { id: true } });
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    if (!(await findProject(orgId, contractId, projectId))) return apiError("NOT_FOUND", "Project not found.", 404);
    return NextResponse.json(await loadPas2080(orgId, projectId));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, ...PAS2080_EDITORS);
    if (!(await findProject(orgId, contractId, projectId))) return apiError("NOT_FOUND", "Project not found.", 404);

    const body = planSchema.parse(await req.json());
    if (body.baselineTco2e != null && body.targetTco2e != null && body.targetTco2e >= body.baselineTco2e) {
      return apiError("TARGET_NOT_BELOW_BASELINE", "The target must be below the baseline.", 422);
    }
    const data = {
      valueChainRole: body.valueChainRole,
      carbonLeadName: body.carbonLeadName || null,
      baselineTco2e: body.baselineTco2e ?? null,
      baselineBasis: body.baselineBasis || null,
      targetTco2e: body.targetTco2e ?? null,
      modulesInScope: body.modulesInScope,
      notes: body.notes || null,
      updatedByUserId: session.user.id,
    };
    // A plan is unique per project; the project was checked to be this org's.
    const plan = await prisma.carbonManagementPlan.upsert({
      where: { projectId },
      create: { organizationId: orgId, projectId, ...data },
      update: data,
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "pas2080.plan_updated",
      resourceType: "carbon_management_plan",
      resourceId: plan.id,
      metadata: { projectId, baselineTco2e: data.baselineTco2e, targetTco2e: data.targetTco2e, modulesInScope: data.modulesInScope },
    });
    return NextResponse.json(plan);
  } catch (err) {
    return handleRouteError(err);
  }
}
