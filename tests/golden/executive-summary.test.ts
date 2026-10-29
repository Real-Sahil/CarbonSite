// @vitest-environment node
// The Executive Summary reads one grouped SQL statement (lib/dashboard/executive-summary.ts). This checks
// its figures against independent Prisma queries on a calculated organisation with a prior period, a
// target and open work, next to a second organisation whose rows must never be counted, and checks that
// the Summary total equals the dashboard's live total for the same period (the report-dashboard trust
// invariant). Needs a migrated, seeded database, so it only runs with RUN_DB_TESTS=1.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { defaultRunInputs } from "@/lib/calculation/default-run-inputs";
import { loadLiveTotals } from "@/lib/realtime/live-totals";
import { loadExecutiveSummary, type SummaryPeriod } from "@/lib/dashboard/executive-summary";

const RUN = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!RUN)("executive summary loader", () => {
  const tag = `exec-${Date.now()}`;
  const NOW = new Date("2025-12-31T12:00:00Z");
  let orgId = "";
  let otherOrgId = "";
  let emptyOrgId = "";
  let current: SummaryPeriod;
  let priorId = "";
  let otherCurrent: SummaryPeriod;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `${tag}@example.test`, name: "Summary" } });
    const category = await prisma.emissionCategory.findFirstOrThrow({ where: { code: "s2-electricity-lb" } });

    async function periodWithRun(organizationId: string, label: string, start: string, end: string, kwh: number[]) {
      const period = await prisma.reportingPeriod.create({
        data: { organizationId, type: "year", startDate: new Date(start), endDate: new Date(end), label },
      });
      for (const amount of kwh) {
        await prisma.activityRecord.create({
          data: {
            organizationId,
            reportingPeriodId: period.id,
            emissionCategoryId: category.id,
            amount,
            unit: "kWh",
            activityDate: new Date(start),
            reviewStatus: "approved",
            createdByUserId: user.id,
          },
        });
      }
      const inputs = await defaultRunInputs(organizationId, period.id);
      const run = await prisma.calculationRun.create({
        data: { organizationId, reportingPeriodId: period.id, triggeredByUserId: user.id, triggerHash: `${tag}-${organizationId}-${label}`, ...inputs! },
      });
      for (let i = 0; i < 20 && !(await processCalculationRun(run.id, organizationId)).done; i++);
      return period;
    }

    const org = await prisma.organization.create({ data: { name: `${tag}-a`, hqCountry: "GB" } });
    orgId = org.id;
    await prisma.organizationMembership.create({ data: { organizationId: orgId, userId: user.id, role: "admin" } });
    const prior = await periodWithRun(orgId, "FY2024", "2024-01-01", "2024-12-31", [20000, 20000]);
    const cur = await periodWithRun(orgId, "FY2025", "2025-01-01", "2025-12-31", [10000, 15000, 25000]);
    priorId = prior.id;
    current = { id: cur.id, label: cur.label, startDate: cur.startDate, endDate: cur.endDate };

    // An absolute target: the 2024 baseline less 5,000 kg, due at the end of 2025.
    await prisma.reductionTarget.create({
      data: {
        organizationId: orgId,
        baselinePeriodId: prior.id,
        targetPeriodId: cur.id,
        targetType: "absolute",
        reductionAmount: 5000,
        createdByUserId: user.id,
      },
    });
    // Open work: two field submissions waiting (one finished, which must not count) and one open review task.
    for (const status of ["pending", "needs_info", "approved"] as const) {
      await prisma.fieldSubmission.create({
        data: { organizationId: orgId, reportingPeriodId: cur.id, submittedByUserId: user.id, documentType: "waste_ticket", status, formData: {} },
      });
    }
    await prisma.reviewTask.create({
      data: { organizationId: orgId, type: "activity_record", targetId: "x", assigneeUserId: user.id, createdByUserId: user.id, status: "open" },
    });

    const other = await prisma.organization.create({ data: { name: `${tag}-b`, hqCountry: "GB" } });
    otherOrgId = other.id;
    await prisma.organizationMembership.create({ data: { organizationId: otherOrgId, userId: user.id, role: "admin" } });
    const otherPeriod = await periodWithRun(otherOrgId, "FY2025", "2025-01-01", "2025-12-31", [999999]);
    otherCurrent = { id: otherPeriod.id, label: otherPeriod.label, startDate: otherPeriod.startDate, endDate: otherPeriod.endDate };

    emptyOrgId = (await prisma.organization.create({ data: { name: `${tag}-empty`, hqCountry: "GB" } })).id;
  }, 240_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const calcKg = async (organizationId: string, reportingPeriodId: string) => {
    const run = await prisma.calculationRun.findFirstOrThrow({
      where: { organizationId, reportingPeriodId, status: "succeeded" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const sum = await prisma.emissionCalculation.aggregate({
      where: { organizationId, calculationRunId: run.id },
      _sum: { totalCo2e: true },
    });
    return Number(sum._sum.totalCo2e ?? 0);
  };

  it("matches independent figures from the calculations", async () => {
    const s = await loadExecutiveSummary(orgId, current, { id: priorId }, NOW);
    const currentKg = await calcKg(orgId, current.id);
    const priorKg = await calcKg(orgId, priorId);

    expect(currentKg).toBeGreaterThan(0);
    expect(s.hasData).toBe(true);
    expect(s.totalTonnes).toBeCloseTo(currentKg / 1000, 6);
    expect(s.scopeTonnes.scope2).toBeCloseTo(currentKg / 1000, 6);
    expect(s.scopeTonnes.scope1).toBe(0);
    expect(s.scopeTonnes.scope3).toBe(0);
    expect(s.changePct).toBeCloseTo(((currentKg - priorKg) / priorKg) * 100, 6);

    expect(s.hotspot?.sharePct).toBeCloseTo(100, 6);
    expect(s.hotspot?.tonnes).toBeCloseTo(currentKg / 1000, 6);

    expect(s.target.hasTarget).toBe(true);
    expect(s.target.baselineTonnes).toBeCloseTo(priorKg / 1000, 6);
    expect(s.target.targetTonnes).toBeCloseTo(priorKg / 1000 - 5, 6);
    expect(s.target.result).not.toBeNull();

    // Two submissions still open, one approved (not counted), one open review task.
    expect(s.needsYou).toEqual({ pendingSubmissions: 2, openReviews: 1 });
  });

  it("reconciles with the dashboard's live total for the same period", async () => {
    const s = await loadExecutiveSummary(orgId, current, { id: priorId }, NOW);
    const live = await loadLiveTotals(orgId);
    expect(live).not.toBeNull();
    expect(s.totalTonnes! * 1000).toBeCloseTo(live!.aggregates.totalCo2e, 3);
    expect(s.scopeTonnes.scope1 * 1000).toBeCloseTo(live!.aggregates.scope1, 3);
    expect(s.scopeTonnes.scope2 * 1000).toBeCloseTo(live!.aggregates.scope2, 3);
    expect(s.scopeTonnes.scope3 * 1000).toBeCloseTo(live!.aggregates.scope3, 3);
  });

  it("counts only the organisation's own rows", async () => {
    const mine = await loadExecutiveSummary(orgId, current, null, NOW);
    const theirs = await loadExecutiveSummary(otherOrgId, otherCurrent, null, NOW);
    expect(theirs.totalTonnes).toBeCloseTo((await calcKg(otherOrgId, otherCurrent.id)) / 1000, 6);
    expect(theirs.totalTonnes).not.toBeCloseTo(mine.totalTonnes!, 3);
    expect(theirs.needsYou).toEqual({ pendingSubmissions: 0, openReviews: 0 });
    expect(theirs.target.hasTarget).toBe(false);
    // Another organisation's period id gives this organisation no figures at all.
    const crossed = await loadExecutiveSummary(orgId, otherCurrent, null, NOW);
    expect(crossed.hasData).toBe(false);
    expect(crossed.totalTonnes).toBeNull();
  });

  it("returns no data and zero counts for an organisation with nothing", async () => {
    const s = await loadExecutiveSummary(emptyOrgId, { ...current, id: "no-such-period" }, null, NOW);
    expect(s.hasData).toBe(false);
    expect(s.totalTonnes).toBeNull();
    expect(s.hotspot).toBeNull();
    expect(s.target.hasTarget).toBe(false);
    expect(s.needsYou).toEqual({ pendingSubmissions: 0, openReviews: 0 });
  });
});
