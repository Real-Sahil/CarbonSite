import { prisma } from "@/lib/db";
import { actualTco2eByYear } from "@/lib/calculation/sbti-actuals";
import { expectedTco2eForYear, type SbtiTargetInput } from "@/lib/calculation/sbti-trajectory";
import { buildPathway, gapAt, transitionChecklist, type Lever, type PlanFields } from "./index";

/**
 * Everything the transition plan page and the E1-1 resolver need, org-scoped:
 * the plan's narrative, the base line (SBTi target baseline, else the active
 * base year), the pathway lines, the near-term gap and the checklist.
 */
export async function loadTransitionPlan(orgId: string, now = new Date()) {
  const [planRow, targetRow, baseYear, initiatives] = await Promise.all([
    prisma.transitionPlan.findUnique({ where: { organizationId: orgId } }),
    prisma.sbtiTarget.findUnique({ where: { organizationId: orgId } }),
    prisma.baseYear.findFirst({
      where: { organizationId: orgId, status: "active" },
      select: { label: true, currentTotalCo2e: true, originalTotalCo2e: true, reportingPeriod: { select: { endDate: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reductionInitiative.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, status: true, expectedImpactCo2e: true, expectedStartDate: true, capexAmount: true, costAmount: true },
      orderBy: { expectedStartDate: "asc" },
    }),
  ]);

  const plan: PlanFields | null = planRow
    ? {
        status: planRow.status,
        ambition: planRow.ambition,
        netZeroYear: planRow.netZeroYear,
        strategy: planRow.strategy,
        engagement: planRow.engagement,
        governance: planRow.governance,
        lockedInEmissions: planRow.lockedInEmissions,
        capexPlanned: planRow.capexPlanned == null ? null : Number(planRow.capexPlanned),
        opexPlanned: planRow.opexPlanned == null ? null : Number(planRow.opexPlanned),
        taxonomyAlignedCapexPct: planRow.taxonomyAlignedCapexPct == null ? null : Number(planRow.taxonomyAlignedCapexPct),
        approvalBody: planRow.approvalBody,
        approvedAt: planRow.approvedAt,
      }
    : null;

  const target: SbtiTargetInput | null = targetRow
    ? {
        pathway: targetRow.pathway,
        baseYear: targetRow.baseYear,
        baselineScope1Tco2e: Number(targetRow.baselineScope1Tco2e),
        baselineScope2Tco2e: Number(targetRow.baselineScope2Tco2e),
        baselineScope3Tco2e: targetRow.baselineScope3Tco2e == null ? null : Number(targetRow.baselineScope3Tco2e),
        nearTermYear: targetRow.nearTermYear,
        nearTermReductionPct: Number(targetRow.nearTermReductionPct),
        netZeroYear: targetRow.netZeroYear,
        netZeroReductionPct: Number(targetRow.netZeroReductionPct),
      }
    : null;

  // ReductionInitiative.expectedImpactCo2e is kgCO2e a year.
  const levers: Lever[] = initiatives.map((i) => ({
    id: i.id,
    name: i.name,
    status: i.status,
    abatementTco2e: i.expectedImpactCo2e == null ? null : Number(i.expectedImpactCo2e) / 1000,
    startYear: i.expectedStartDate ? i.expectedStartDate.getUTCFullYear() : null,
    capex: i.capexAmount != null ? Number(i.capexAmount) : i.costAmount != null ? Number(i.costAmount) : null,
  }));

  const base = target
    ? {
        year: target.baseYear,
        tco2e: target.baselineScope1Tco2e + target.baselineScope2Tco2e + (target.baselineScope3Tco2e ?? 0),
        source: "SBTi target baseline",
      }
    : baseYear && (baseYear.currentTotalCo2e ?? baseYear.originalTotalCo2e) != null
      ? {
          year: baseYear.reportingPeriod.endDate.getUTCFullYear(),
          tco2e: Number(baseYear.currentTotalCo2e ?? baseYear.originalTotalCo2e),
          source: `Base year ${baseYear.label}`,
        }
      : null;

  const endYear = Math.min(2060, Math.max(target?.netZeroYear ?? 0, plan?.netZeroYear ?? 0, 2050));
  const currentYear = now.getUTCFullYear();
  const actuals = base ? await actualTco2eByYear(orgId, base.year, Math.min(currentYear, endYear)) : new Map<number, number>();

  const points = base
    ? buildPathway({
        baseYear: base.year,
        baseTco2e: base.tco2e,
        endYear,
        targetForYear: target ? (y) => expectedTco2eForYear(target, y) : null,
        actualByYear: actuals,
        levers,
      })
    : [];

  const nearTermYear = target?.nearTermYear ?? (base ? Math.max(base.year + 5, 2030) : null);
  const nearTermGap = nearTermYear != null ? gapAt(points, nearTermYear) : null;
  const latest = [...points].reverse().find((p) => p.actual != null && p.year > (base?.year ?? 0));
  const latestActual = latest ? { year: latest.year, actual: latest.actual!, expected: latest.target ?? latest.reference } : null;

  const checklist = transitionChecklist({
    plan,
    target: target
      ? {
          baseYear: target.baseYear,
          nearTermYear: target.nearTermYear,
          nearTermReductionPct: target.nearTermReductionPct,
          netZeroYear: target.netZeroYear,
          coversScope3: target.baselineScope3Tco2e != null,
        }
      : null,
    levers,
    nearTermGap,
    latestActual,
  });

  return {
    plan,
    approvedByUserId: planRow?.approvedByUserId ?? null,
    currency: planRow?.currency ?? "GBP",
    base,
    target,
    levers,
    points,
    nearTermGap,
    checklist,
    unscheduled: levers.filter((l) => l.status !== "canceled" && (l.abatementTco2e ?? 0) > 0 && l.startYear == null),
  };
}

export type TransitionPlanView = Awaited<ReturnType<typeof loadTransitionPlan>>;
