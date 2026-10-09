import { prisma } from "@/lib/db";
import { compareToForecast, swmpChecks, wastePlanLinesSchema, type PlanLine } from "./swmp";

/** A project's plan (or null) with the checks and the actual waste set beside the forecast. Always inside the organisation. */
export async function loadWastePlan(orgId: string, projectId: string) {
  const [plan, records] = await Promise.all([
    prisma.siteWastePlan.findFirst({ where: { organizationId: orgId, projectId } }),
    prisma.wasteRecord.findMany({
      where: { organizationId: orgId, projectId },
      take: 20000,
      select: { wasteType: true, ewcCode: true, disposalRoute: true, weightTonnes: true },
    }),
  ]);
  const parsed = wastePlanLinesSchema.safeParse(plan?.lines ?? []);
  const lines: PlanLine[] = parsed.success ? parsed.data : [];
  const view = {
    responsiblePerson: plan?.responsiblePerson ?? null,
    principalContractor: plan?.principalContractor ?? null,
    clientName: plan?.clientName ?? null,
    targetDiversionPct: plan?.targetDiversionPct != null ? Number(plan.targetDiversionPct) : null,
    actions: plan?.actions ?? null,
    nextReviewOn: plan?.nextReviewOn ? plan.nextReviewOn.toISOString().slice(0, 10) : null,
    lines,
  };
  return {
    exists: !!plan,
    status: plan?.status ?? "draft",
    version: plan?.version ?? 0,
    approvedAt: plan?.approvedAt ?? null,
    plan: view,
    checks: swmpChecks(view),
    comparison: compareToForecast(lines, records.map((r) => ({ wasteType: r.wasteType, ewcCode: r.ewcCode, route: r.disposalRoute, tonnes: Number(r.weightTonnes) }))),
    recordCount: records.length,
  };
}
