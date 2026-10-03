import { prisma } from "@/lib/db";
import { scopeTotalsFromRollup } from "@/lib/bids/carbon-pack";
import { orgFormat } from "@/lib/i18n/org-format";
import { parseSections, tcfdChecklist, type RiskRow, type ScenarioRow } from "./index";

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

/**
 * Everything the climate disclosure page and report need, scoped to the
 * organisation: the statement's narrative, the organisation's TCFD scenarios
 * and risk assessments, the published totals of one snapshot (the given one,
 * else the latest) and the checklist.
 */
export async function loadClimateDisclosure(orgId: string, snapshotId?: string) {
  const [row, scenarioRows, riskRows, snapshot, reductionTargets, sbti, transition, org] = await Promise.all([
    prisma.climateDisclosure.findUnique({ where: { organizationId: orgId } }),
    prisma.tcfdScenario.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } }),
    prisma.tcfdRiskAssessment.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } }),
    prisma.publishedSnapshot.findFirst({
      where: { organizationId: orgId, ...(snapshotId ? { id: snapshotId } : {}) },
      orderBy: [{ reportingPeriod: { endDate: "desc" } }, { version: "desc" }],
      select: { id: true, version: true, publishedAt: true, reportingPeriod: { select: { label: true, startDate: true, endDate: true } } },
    }),
    prisma.reductionTarget.findMany({
      where: { organizationId: orgId },
      select: {
        targetType: true,
        reductionAmount: true,
        baselinePeriod: { select: { label: true } },
        targetPeriod: { select: { label: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sbtiTarget.findUnique({ where: { organizationId: orgId }, select: { id: true } }),
    prisma.transitionPlan.findUnique({ where: { organizationId: orgId }, select: { netZeroYear: true } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { hqCountry: true, reportingCurrency: true } }),
  ]);

  const rollup = snapshot
    ? await prisma.dashboardAggregate.findMany({
        where: { organizationId: orgId, snapshotId: snapshot.id, emissionCategoryId: null, facilityId: null, businessUnitId: null },
        select: { snapshotId: true, scope: true, scope2Method: true, totalCo2e: true },
      })
    : [];
  const totals = snapshot ? scopeTotalsFromRollup(rollup) : null;
  const hasTarget = reductionTargets.length > 0 || !!sbti || transition?.netZeroYear != null;

  const sections = parseSections(row?.sections);
  const scenarios: ScenarioRow[] = scenarioRows.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.scenarioType,
    pathway: s.temperaturePathway,
    horizon: s.timeHorizon,
    description: s.description,
    valueAtRiskLow: num(s.grossValueAtRiskLow),
    valueAtRiskHigh: num(s.grossValueAtRiskHigh),
  }));
  const risks: RiskRow[] = riskRows.map((r) => ({
    id: r.id,
    scenarioId: r.scenarioId,
    category: r.riskCategory,
    description: r.description,
    likelihood: r.likelihood,
    impact: r.impact,
    residualLikelihood: r.residualLikelihood,
    residualImpact: r.residualImpact,
    financialLow: num(r.financialImpactLow),
    financialHigh: num(r.financialImpactHigh),
    actions: r.adaptationActions,
    reviewDate: r.reviewDate,
  }));

  const checklist = tcfdChecklist({
    sections,
    scenarios,
    risks,
    totals: snapshot && totals ? { periodLabel: snapshot.reportingPeriod.label, scope3Tonnes: totals.s3 } : null,
    hasTarget,
  });

  return {
    exists: !!row,
    status: row?.status ?? "draft",
    approvalBody: row?.approvalBody ?? null,
    approvedAt: row?.approvedAt ?? null,
    updatedAt: row?.updatedAt ?? null,
    sections,
    scenarios,
    risks,
    snapshot: snapshot
      ? { id: snapshot.id, version: snapshot.version, publishedAt: snapshot.publishedAt, ...snapshot.reportingPeriod }
      : null,
    totals,
    targets: reductionTargets.map((t) => ({
      type: t.targetType,
      from: t.baselinePeriod.label,
      to: t.targetPeriod.label,
      reductionTonnes: Number(t.reductionAmount) / 1000,
    })),
    netZeroYear: transition?.netZeroYear ?? null,
    format: orgFormat(org ?? {}),
    checklist,
  };
}

export type ClimateDisclosureView = Awaited<ReturnType<typeof loadClimateDisclosure>>;
