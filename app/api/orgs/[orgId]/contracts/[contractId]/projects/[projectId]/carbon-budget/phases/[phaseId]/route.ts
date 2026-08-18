export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";

const EDIT_ROLES = ["admin", "sustainability_director", "sustainability_manager", "contract_manager", "project_manager"] as const;

const PhaseUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  budgetTco2e: z.number().positive().optional(),
  actualTco2e: z.number().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
});

type Params = { params: Promise<{ orgId: string; contractId: string; projectId: string; phaseId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId, phaseId } = await params;
    await requireOrgMember(orgId, ...EDIT_ROLES);

    const budget = await prisma.carbonBudget.findFirst({
      where: { projectId, organizationId: orgId, project: { contractId } },
      select: { id: true },
    });
    if (!budget) return apiError("NOT_FOUND", "Carbon budget not found", 404);

    const phase = await prisma.carbonBudgetPhase.findFirst({
      where: { id: phaseId, budgetId: budget.id },
    });
    if (!phase) return apiError("NOT_FOUND", "Phase not found", 404);

    const body = PhaseUpdateSchema.parse(await req.json());

    const updated = await prisma.carbonBudgetPhase.update({
      where: { id: phaseId },
      data: body,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId, phaseId } = await params;
    await requireOrgMember(orgId, ...EDIT_ROLES);

    const budget = await prisma.carbonBudget.findFirst({
      where: { projectId, organizationId: orgId, project: { contractId } },
      select: { id: true },
    });
    if (!budget) return apiError("NOT_FOUND", "Carbon budget not found", 404);

    const phase = await prisma.carbonBudgetPhase.findFirst({
      where: { id: phaseId, budgetId: budget.id },
      select: { id: true },
    });
    if (!phase) return apiError("NOT_FOUND", "Phase not found", 404);

    await prisma.carbonBudgetPhase.delete({ where: { id: phaseId } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
