// @vitest-environment node
// The dashboard reads its counts, the latest run's data quality figures and
// the published snapshots' libraries through one SQL statement each
// (lib/dashboard/page-data.ts) instead of one Prisma query per figure. This
// checks those statements against the Prisma queries they replaced, on an
// organisation with mixed review states, evidence, a zero result, a fallback
// factor and a record added after the run, next to a second organisation
// whose rows must never be counted. Needs a migrated, seeded database, so it
// only runs with RUN_DB_TESTS=1 like the golden inventory test.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { defaultRunInputs } from "@/lib/calculation/default-run-inputs";
import { loadDashboardCounts, loadLatestRunStats, loadPublishedLibraries } from "@/lib/dashboard/page-data";

const RUN = process.env.RUN_DB_TESTS === "1";

const REVIEW = ["approved", "approved", "approved", "in_review", "draft", "rejected"] as const;

async function prismaFigures(orgId: string) {
  const run = await prisma.calculationRun.findFirst({
    where: { organizationId: orgId, status: "succeeded" },
    orderBy: { createdAt: "desc" },
    select: { id: true, finishedAt: true, reportingPeriodId: true },
  });
  const sum = (where: object) =>
    prisma.emissionCalculation
      .aggregate({ where: { calculationRunId: run!.id, organizationId: orgId, ...where }, _sum: { totalCo2e: true } })
      .then((a) => Number(a._sum.totalCo2e ?? 0));
  return {
    counts: {
      records: await prisma.activityRecord.count({ where: { organizationId: orgId } }),
      approvedRecords: await prisma.activityRecord.count({ where: { organizationId: orgId, reviewStatus: "approved" } }),
      approvedWithoutEvidence: await prisma.activityRecord.count({
        where: { organizationId: orgId, reviewStatus: "approved", evidence: { none: {} } },
      }),
      pendingAttention: await prisma.activityRecord.count({
        where: { organizationId: orgId, reviewStatus: { in: ["in_review", "draft"] } },
      }),
      imports: await prisma.importBatch.count({ where: { organizationId: orgId } }),
      failedImports: await prisma.importBatch.count({
        where: { organizationId: orgId, state: { in: ["failed", "needs_attention"] } },
      }),
      failedCalculations: await prisma.calculationRun.count({ where: { organizationId: orgId, status: "failed" } }),
      openReviewTasks: await prisma.reviewTask.count({ where: { organizationId: orgId, status: "open" } }),
      targets: await prisma.reductionTarget.count({ where: { organizationId: orgId } }),
      initiatives: await prisma.reductionInitiative.count({ where: { organizationId: orgId } }),
      evidenceFiles: await prisma.evidenceFile.count({ where: { organizationId: orgId } }),
      sites: await prisma.site.count({ where: { organizationId: orgId } }),
      fieldWorkers: await prisma.organizationMembership.count({ where: { organizationId: orgId, role: "field_worker" } }),
    },
    run: run && {
      runId: run.id,
      finishedAt: run.finishedAt,
      reportingPeriodId: run.reportingPeriodId,
      calculationCount: await prisma.emissionCalculation.count({ where: { organizationId: orgId, calculationRunId: run.id } }),
      zeroCo2eCount: await prisma.emissionCalculation.count({
        where: { organizationId: orgId, calculationRunId: run.id, totalCo2e: 0 },
      }),
      noFactorCount: await prisma.emissionCalculation.count({
        where: { organizationId: orgId, calculationRunId: run.id, totalCo2e: 0, emissionFactorId: null, organizationEmissionFactorId: null },
      }),
      totalCo2e: await sum({}),
      approvedCo2e: await sum({ activityRecord: { reviewStatus: "approved" } }),
      fallbackCo2e: await sum({ selectionReason: { contains: "fallback", mode: "insensitive" } }),
      recordsAddedSince: run.finishedAt
        ? await prisma.activityRecord.count({
            where: { organizationId: orgId, reportingPeriodId: run.reportingPeriodId, createdAt: { gt: run.finishedAt } },
          })
        : 0,
    },
    published: await prisma.publishedSnapshot.findMany({
      where: { organizationId: orgId },
      orderBy: [{ reportingPeriodId: "asc" }, { version: "desc" }],
      select: {
        reportingPeriodId: true,
        version: true,
        reportingPeriod: { select: { label: true } },
        calculationRun: {
          select: {
            factorLibrary: { select: { id: true, name: true, version: true } },
            methodologyVersion: { select: { name: true } },
          },
        },
      },
    }),
  };
}

async function loaderFigures(orgId: string) {
  return {
    counts: await loadDashboardCounts(orgId),
    run: await loadLatestRunStats(orgId),
    published: await loadPublishedLibraries(orgId),
  };
}

describe.skipIf(!RUN)("dashboard page data", () => {
  const tag = `dash-${Date.now()}`;
  let orgId = "";
  let otherOrgId = "";
  let emptyOrgId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `${tag}@example.test`, name: "Dashboard" } });
    const categoryId = (await prisma.emissionCategory.findFirstOrThrow({ where: { code: "s2-electricity-lb" } })).id;

    async function orgWithRun(name: string, recordCount: number) {
      const org = await prisma.organization.create({ data: { name, hqCountry: "GB" } });
      await prisma.organizationMembership.create({ data: { organizationId: org.id, userId: user.id, role: "admin" } });
      const period = await prisma.reportingPeriod.create({
        data: { organizationId: org.id, type: "year", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), label: "FY2025" },
      });
      const file = await prisma.evidenceFile.create({
        data: {
          organizationId: org.id,
          filename: "bill.pdf",
          mimeType: "application/pdf",
          byteSize: 1,
          storageKey: `org/${org.id}/evidence/x/bill.pdf`,
          checksum: `${tag}-${name}`,
          uploadedByUserId: user.id,
        },
      });
      const ids: string[] = [];
      for (let i = 0; i < recordCount; i++) {
        const rec = await prisma.activityRecord.create({
          data: {
            organizationId: org.id,
            reportingPeriodId: period.id,
            emissionCategoryId: categoryId,
            amount: 1000 * (i + 1),
            unit: "kWh",
            activityDate: new Date("2025-06-30"),
            reviewStatus: REVIEW[i % REVIEW.length],
            createdByUserId: user.id,
          },
        });
        ids.push(rec.id);
      }
      // Evidence on the first approved record only.
      await prisma.activityRecordEvidence.create({
        data: { organizationId: org.id, activityRecordId: ids[0], evidenceFileId: file.id },
      });
      const inputs = await defaultRunInputs(org.id, period.id);
      const run = await prisma.calculationRun.create({
        data: { organizationId: org.id, reportingPeriodId: period.id, triggeredByUserId: user.id, triggerHash: `${tag}-${name}`, ...inputs! },
      });
      for (let i = 0; i < 20 && !(await processCalculationRun(run.id, org.id)).done; i++);
      await prisma.publishedSnapshot.create({
        data: { organizationId: org.id, reportingPeriodId: period.id, calculationRunId: run.id, publishedByUserId: user.id, version: 1 },
      });
      return { org, period, run, ids };
    }

    const a = await orgWithRun(`${tag}-a`, 12);
    orgId = a.org.id;
    // Test fixtures only: give the run a zero result and a fallback factor,
    // which the engine would not produce for these records.
    const calcs = await prisma.emissionCalculation.findMany({ where: { calculationRunId: a.run.id }, orderBy: { id: "asc" } });
    await prisma.emissionCalculation.update({ where: { id: calcs[0].id }, data: { totalCo2e: 0 } });
    await prisma.emissionCalculation.update({ where: { id: calcs[1].id }, data: { selectionReason: "Used FALLBACK factor" } });
    // A calculated record sent back for review, so not all CO2e is approved.
    await prisma.activityRecord.update({ where: { id: calcs[2].activityRecordId }, data: { reviewStatus: "in_review" } });
    // A record added after the run finished.
    await prisma.activityRecord.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: a.period.id,
        emissionCategoryId: categoryId,
        amount: 5,
        unit: "kWh",
        activityDate: new Date("2025-07-01"),
        createdByUserId: user.id,
        createdAt: new Date(Date.now() + 60_000),
      },
    });

    otherOrgId = (await orgWithRun(`${tag}-b`, 5)).org.id;
    emptyOrgId = (await prisma.organization.create({ data: { name: `${tag}-empty`, hqCountry: "GB" } })).id;
  }, 180_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("matches the per-figure Prisma queries it replaced", async () => {
    const expected = await prismaFigures(orgId);
    expect(await loaderFigures(orgId)).toEqual(expected);
    // The fixture actually exercises every branch.
    expect(expected.run).toMatchObject({ zeroCo2eCount: 1, recordsAddedSince: 1 });
    expect(expected.run!.fallbackCo2e).toBeGreaterThan(0);
    expect(expected.run!.approvedCo2e).toBeLessThan(expected.run!.totalCo2e);
    expect(expected.counts.approvedWithoutEvidence).toBe(expected.counts.approvedRecords - 1);
  });

  it("counts only the organisation's own rows", async () => {
    const other = await loaderFigures(otherOrgId);
    expect(other).toEqual(await prismaFigures(otherOrgId));
    expect(other.counts.records).toBe(5);
  });

  it("returns zeros and no run for an organisation with no data", async () => {
    const empty = await loaderFigures(emptyOrgId);
    expect(empty).toEqual(await prismaFigures(emptyOrgId));
    expect(empty.run).toBeNull();
    expect(empty.counts.records).toBe(0);
  });
});
