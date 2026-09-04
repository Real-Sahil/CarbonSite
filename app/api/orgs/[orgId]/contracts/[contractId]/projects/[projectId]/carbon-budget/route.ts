export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { setCarbonBudgetSchema } from "@/lib/validation/project-carbon";

type Params = { params: Promise<{ orgId: string; contractId: string; projectId: string }> };

/**
 * The project's real, measured actual emissions to date — embodied carbon
 * records plus activity-record emissions on the project's sites, taking
 * only the latest calculation run per record so re-running calculations
 * doesn't double count. This is the top-line "actual" the carbon-budget
 * page shows; it is never derived from the per-phase actualTco2e figures,
 * which are a separate, manually reconciled allocation (see
 * CarbonBudgetPhase.percentComplete in schema.prisma).
 */
async function computeProjectActualTco2e(orgId: string, projectId: string): Promise<number> {
  const [embodiedAgg, activityRows] = await Promise.all([
    prisma.embodiedCarbonRecord.aggregate({
      where: { organizationId: orgId, projectId },
      _sum: { totalKgCo2e: true },
    }),
    prisma.$queryRaw<Array<{ total_co2e: number }>>`
      SELECT COALESCE(SUM(ec.total_co2e), 0)::float AS total_co2e
      FROM activity_records ar
      JOIN sites s ON s.id = ar.site_id
      LEFT JOIN LATERAL (
        SELECT total_co2e FROM emission_calculations
        WHERE activity_record_id = ar.id
        ORDER BY created_at DESC LIMIT 1
      ) ec ON TRUE
      WHERE s.project_id = ${projectId}
        AND ar.organization_id = ${orgId}
        AND ar.review_status = 'approved'
    `,
  ]);

  const embodiedKg = embodiedAgg._sum.totalKgCo2e ?? 0;
  const activityKg = Number(activityRows[0]?.total_co2e ?? 0);
  return (embodiedKg + activityKg) / 1000;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const project = await prisma.project.findFirst({ where: { id: projectId, contractId, organizationId: orgId } });
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const [budget, totalActualTco2e] = await Promise.all([
      prisma.carbonBudget.findUnique({
        where: { projectId },
        include: { phases: { orderBy: { sortOrder: "asc" } } },
      }),
      computeProjectActualTco2e(orgId, projectId),
    ]);

    return NextResponse.json({ budget, totalActualTco2e });
  } catch (err) {
    return handleRouteError(err);
  }
}

async function upsertBudget(
  orgId: string,
  projectId: string,
  data: ReturnType<typeof setCarbonBudgetSchema.parse>,
) {
  return prisma.$transaction(async (tx) => {
    const budget = await tx.carbonBudget.upsert({
      where: { projectId },
      create: {
        organizationId: orgId,
        projectId,
        totalBudgetTco2e: data.totalBudgetTco2e,
        floorAreaM2: data.floorAreaM2 ?? null,
        contractValueGbp: data.contractValueGbp ?? null,
        notes: data.notes ?? null,
      },
      update: {
        totalBudgetTco2e: data.totalBudgetTco2e,
        floorAreaM2: data.floorAreaM2 ?? null,
        contractValueGbp: data.contractValueGbp ?? null,
        notes: data.notes ?? null,
      },
    });

    const existingPhases = await tx.carbonBudgetPhase.findMany({ where: { budgetId: budget.id } });
    const existingByName = new Map(existingPhases.map((p) => [p.name.trim().toLowerCase(), p]));
    const incomingNames = new Set(data.phases.map((p) => p.name.trim().toLowerCase()));

    // Phases dropped from the incoming set are removed — the budget modal
    // lets the user delete a phase row before saving.
    const toDelete = existingPhases.filter((p) => !incomingNames.has(p.name.trim().toLowerCase()));
    if (toDelete.length > 0) {
      await tx.carbonBudgetPhase.deleteMany({ where: { id: { in: toDelete.map((p) => p.id) } } });
    }

    for (const phase of data.phases) {
      const key = phase.name.trim().toLowerCase();
      const existing = existingByName.get(key);
      if (existing) {
        // Preserve manually reconciled progress (actualTco2e, percentComplete)
        // — only the budget figure, ordering and notes come from this form.
        await tx.carbonBudgetPhase.update({
          where: { id: existing.id },
          data: {
            budgetTco2e: phase.budgetTco2e,
            sortOrder: phase.sortOrder,
            notes: phase.notes ?? null,
          },
        });
      } else {
        await tx.carbonBudgetPhase.create({
          data: {
            budgetId: budget.id,
            name: phase.name,
            budgetTco2e: phase.budgetTco2e,
            sortOrder: phase.sortOrder,
            notes: phase.notes ?? null,
          },
        });
      }
    }

    return tx.carbonBudget.findUniqueOrThrow({
      where: { id: budget.id },
      include: { phases: { orderBy: { sortOrder: "asc" } } },
    });
  });
}

async function handleSet(req: NextRequest, params: Params["params"], auditAction: "carbon_budget.set" | "carbon_budget.updated") {
  const { orgId, contractId, projectId } = await params;
  const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);

  const project = await prisma.project.findFirst({ where: { id: projectId, contractId, organizationId: orgId } });
  if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

  const body = await req.json().catch(() => null);
  const parsed = setCarbonBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid carbon budget data.", 400, parsed.error.flatten());
  }

  const budget = await upsertBudget(orgId, projectId, parsed.data);

  await writeAuditLog({
    organizationId: orgId,
    actorUserId: session.user.id,
    action: auditAction,
    resourceType: "CarbonBudget",
    resourceId: budget.id,
    metadata: { projectId, totalBudgetTco2e: parsed.data.totalBudgetTco2e, phaseCount: parsed.data.phases.length },
  });

  return NextResponse.json({ budget });
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    return await handleSet(req, params, "carbon_budget.set");
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    return await handleSet(req, params, "carbon_budget.updated");
  } catch (err) {
    return handleRouteError(err);
  }
}

