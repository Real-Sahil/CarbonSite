import { prisma } from "@/lib/db";
import { computeCarbonEvm } from "./evm";
import { computeBurndown, type Burndown, type MonthPoint } from "./burndown";
import { HEADLINE_ONLY } from "./sql";

/**
 * A project's measured carbon by month, tCO2e: approved activity on its sites
 * (by activity date, else period start, else when recorded), using each
 * record's latest calculation and leaving out market-based Scope 2, plus its
 * embodied carbon records by the month they were recorded. Same scope as
 * measuredProjectTco2e(), so the burn-down total equals the headline actual.
 */
export async function monthlyProjectTco2e(orgId: string, projectId: string): Promise<MonthPoint[]> {
  const [activity, embodied] = await Promise.all([
    prisma.$queryRaw<Array<{ month: string; kg: number }>>`
      SELECT to_char(date_trunc('month', COALESCE(ar.activity_date, ar.start_date, ar.created_at::date)), 'YYYY-MM') AS month,
             COALESCE(SUM(ec.total_co2e), 0)::float AS kg
      FROM activity_records ar
      JOIN sites s ON s.id = ar.site_id
      JOIN emission_categories cat ON cat.id = ar.emission_category_id
      LEFT JOIN LATERAL (
        SELECT total_co2e FROM emission_calculations
        WHERE activity_record_id = ar.id
        ORDER BY created_at DESC LIMIT 1
      ) ec ON TRUE
      WHERE s.project_id = ${projectId}
        AND s.organization_id = ${orgId}
        AND ar.organization_id = ${orgId}
        AND ar.review_status = 'approved'
        AND ${HEADLINE_ONLY}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ month: string; kg: number }>>`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
             COALESCE(SUM(total_kg_co2e), 0)::float AS kg
      FROM embodied_carbon_records
      WHERE organization_id = ${orgId} AND project_id = ${projectId}
      GROUP BY 1
    `,
  ]);
  return [...activity, ...embodied]
    .filter((r) => Number(r.kg) !== 0)
    .map((r) => ({ month: r.month, tco2e: Number(r.kg) / 1000 }));
}

/** The burn-down for a project that has a carbon budget, or null when it has none. Org-scoped. */
export async function loadProjectBurndown(orgId: string, projectId: string, asOf = new Date()): Promise<Burndown | null> {
  const [project, budget] = await Promise.all([
    prisma.project.findFirst({ where: { id: projectId, organizationId: orgId }, select: { startDate: true, endDate: true } }),
    prisma.carbonBudget.findFirst({
      where: { projectId, organizationId: orgId },
      select: { totalBudgetTco2e: true, phases: { select: { budgetTco2e: true, actualTco2e: true, percentComplete: true } } },
    }),
  ]);
  if (!project || !budget) return null;

  const monthly = await monthlyProjectTco2e(orgId, projectId);
  const evm = budget.phases.length
    ? computeCarbonEvm(
        budget.phases.map((p) => ({
          budgetTco2e: Number(p.budgetTco2e),
          actualTco2e: Number(p.actualTco2e),
          percentComplete: Number(p.percentComplete),
        })),
      )
    : null;

  return computeBurndown({
    budgetTco2e: Number(budget.totalBudgetTco2e),
    start: project.startDate,
    end: project.endDate,
    monthly,
    asOf,
    evm,
  });
}
