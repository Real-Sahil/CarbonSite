export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const EDIT_ROLES = ["admin", "sustainability_director", "sustainability_manager", "contract_manager", "project_manager"] as const;

const BudgetSchema = z.object({
  totalBudgetTco2e: z.number().positive(),
  floorAreaM2: z.number().positive().optional(),
  contractValueGbp: z.number().positive().optional(),
  notes: z.string().max(2000).optional(),
  phases: z.array(z.object({
    name: z.string().min(1).max(100),
    budgetTco2e: z.number().positive(),
    sortOrder: z.number().int().min(0).optional(),
    notes: z.string().max(500).optional(),
  })).min(1).max(10).optional(),
});

type Params = { params: Promise<{ orgId: string; contractId: string; projectId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager",
      "contract_manager", "project_manager", "site_manager", "editor", "viewer", "auditor");

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, contractId },
      select: { id: true, name: true },
    });
    if (!project) return apiError("NOT_FOUND", "Project not found", 404);

    const budget = await prisma.carbonBudget.findUnique({
      where: { projectId },
      include: { phases: { orderBy: { sortOrder: "asc" } } },
    });

    // Derive actual tCO2e from activity records on this project's sites
    const sites = await prisma.site.findMany({
      where: { projectId, organizationId: orgId },
      select: { id: true },
    });
    const siteIds = sites.map((s) => s.id);

    const calcActuals = await prisma.emissionCalculation.aggregate({
      where: { activityRecord: { organizationId: orgId, siteId: { in: siteIds.length ? siteIds : undefined } } },
      _sum: { totalCo2e: true },
    });

    const wasteActuals = await prisma.wasteRecord.aggregate({
      where: { organizationId: orgId, projectId },
      _sum: { co2eTonnes: true },
    });

    const totalActualTco2e =
      Number(calcActuals._sum?.totalCo2e ?? 0) +
      Number(wasteActuals._sum?.co2eTonnes ?? 0);

    return NextResponse.json({ budget, totalActualTco2e });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, ...EDIT_ROLES);

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, contractId },
      select: { id: true },
    });
    if (!project) return apiError("NOT_FOUND", "Project not found", 404);

    const existing = await prisma.carbonBudget.findUnique({ where: { projectId }, select: { id: true } });
    if (existing) return apiError("CONFLICT", "Carbon budget already exists for this project. Use PATCH to update.", 409);

    const body = BudgetSchema.parse(await req.json());

    const budget = await prisma.carbonBudget.create({
      data: {
        organizationId: orgId,
        projectId,
        totalBudgetTco2e: body.totalBudgetTco2e,
        floorAreaM2: body.floorAreaM2,
        contractValueGbp: body.contractValueGbp,
        notes: body.notes,
        phases: body.phases
          ? {
              create: body.phases.map((p, i) => ({
                name: p.name,
                budgetTco2e: p.budgetTco2e,
                sortOrder: p.sortOrder ?? i,
                notes: p.notes,
              })),
            }
          : undefined,
      },
      include: { phases: { orderBy: { sortOrder: "asc" } } },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.created",
      resourceType: "carbon_budget",
      resourceId: budget.id,
      metadata: { projectId, totalBudgetTco2e: body.totalBudgetTco2e },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, ...EDIT_ROLES);

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, contractId },
      select: { id: true },
    });
    if (!project) return apiError("NOT_FOUND", "Project not found", 404);

    const budget = await prisma.carbonBudget.findUnique({ where: { projectId } });
    if (!budget) return apiError("NOT_FOUND", "No budget set for this project", 404);
    if (budget.organizationId !== orgId) return apiError("FORBIDDEN", "Access denied", 403);

    const body = BudgetSchema.partial().parse(await req.json());

    const updated = await prisma.carbonBudget.update({
      where: { projectId },
      data: {
        totalBudgetTco2e: body.totalBudgetTco2e,
        floorAreaM2: body.floorAreaM2,
        contractValueGbp: body.contractValueGbp,
        notes: body.notes,
      },
      include: { phases: { orderBy: { sortOrder: "asc" } } },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.updated",
      resourceType: "carbon_budget",
      resourceId: budget.id,
      metadata: {
        totalBudgetTco2e: body.totalBudgetTco2e ?? null,
        floorAreaM2: body.floorAreaM2 ?? null,
        contractValueGbp: body.contractValueGbp ?? null,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
