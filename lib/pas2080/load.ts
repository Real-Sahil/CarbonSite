import { prisma } from "@/lib/db";
import { measuredProjectTco2e } from "@/lib/project-carbon/measured";
import { pas2080Checks, pas2080Position, type PlanInput } from "./index";

/** The project's plan, opportunity log, position and checks. Org-scoped throughout. */
export async function loadPas2080(orgId: string, projectId: string) {
  const [plan, opportunities, measured] = await Promise.all([
    prisma.carbonManagementPlan.findFirst({ where: { organizationId: orgId, projectId } }),
    prisma.carbonReductionOpportunity.findMany({
      where: { organizationId: orgId, projectId },
      orderBy: [{ hierarchyLevel: "asc" }, { createdAt: "asc" }],
    }),
    measuredProjectTco2e(orgId, projectId),
  ]);
  const planInput: PlanInput | null = plan
    ? {
        valueChainRole: plan.valueChainRole,
        carbonLeadName: plan.carbonLeadName,
        baselineTco2e: plan.baselineTco2e != null ? Number(plan.baselineTco2e) : null,
        baselineBasis: plan.baselineBasis,
        targetTco2e: plan.targetTco2e != null ? Number(plan.targetTco2e) : null,
        modulesInScope: plan.modulesInScope,
      }
    : null;
  const opps = opportunities.map((o) => ({
    ...o,
    estimatedSavingTco2e: o.estimatedSavingTco2e != null ? Number(o.estimatedSavingTco2e) : null,
  }));
  const position = pas2080Position(planInput, opps, measured.total);
  return {
    plan: plan && planInput ? { ...plan, ...planInput } : null,
    opportunities: opps,
    measured,
    position,
    checks: pas2080Checks(planInput, opps, position),
  };
}
