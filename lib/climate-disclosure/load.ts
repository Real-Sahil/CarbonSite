import { prisma } from "@/lib/db";
import { scopeTotalsFromRollup } from "@/lib/bids/carbon-pack";
import { parseSections, tcfdChecklist, type RiskRow } from "./index";

/**
 * Everything the climate disclosure page and report need, scoped to the
 * organisation: the statement's narrative, the risk register, the published
 * totals of one snapshot (the given one, else the latest) and the checklist.
 */
export async function loadClimateDisclosure(orgId: string, snapshotId?: string) {
  const [row, riskRows, snapshot, reductionTargets, sbti, transition] = await Promise.all([
    prisma.climateDisclosure.findUnique({ where: { organizationId: orgId } }),
    prisma.climateRisk.findMany({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: "asc" }],
    }),
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
  const risks: RiskRow[] = riskRows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    description: r.description,
    horizon: r.horizon,
    inherentLikelihood: r.inherentLikelihood,
    inherentImpact: r.inherentImpact,
    residualLikelihood: r.residualLikelihood,
    residualImpact: r.residualImpact,
    mitigation: r.mitigation,
    financialEffect: r.financialEffect,
    ownerRole: r.ownerRole,
    status: r.status,
  }));

  const checklist = tcfdChecklist({
    sections,
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
    checklist,
  };
}

export type ClimateDisclosureView = Awaited<ReturnType<typeof loadClimateDisclosure>>;
