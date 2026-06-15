import { prisma } from "@/lib/db";
import { normalizeUnit, UnitError } from "./units";
import { selectFactor } from "./factor-selector";
import { computeCo2e, toDecimal } from "./engine";

export async function processCalculationRun(calculationRunId: string, orgId: string): Promise<void> {
  await prisma.calculationRun.update({
    where: { id: calculationRunId },
    data: { status: "running", startedAt: new Date() },
  });

  try {
    const run = await prisma.calculationRun.findUniqueOrThrow({
      where: { id: calculationRunId },
      include: {
        factorLibrary: { select: { version: true, name: true } },
        methodologyVersion: { select: { name: true } },
      },
    });

    if (run.organizationId !== orgId) {
      throw new Error("Org mismatch on calculation run.");
    }

    // Load all approved records for this period
    const records = await prisma.activityRecord.findMany({
      where: {
        organizationId: orgId,
        reportingPeriodId: run.reportingPeriodId,
        reviewStatus: "approved",
      },
      include: {
        emissionCategory: { select: { id: true, code: true, activityType: true } },
      },
    });

    const factorLibraryVersion = `${run.factorLibrary.name} ${run.factorLibrary.version}`;
    const methodologyVersionName = run.methodologyVersion.name;

    // Process each record
    for (const record of records) {
      const activityDate = record.activityDate ?? record.startDate ?? new Date();

      let normalized: ReturnType<typeof normalizeUnit>;
      const unitWarnings: string[] = [];
      try {
        normalized = normalizeUnit(Number(record.amount), record.unit);
      } catch (err) {
        if (err instanceof UnitError) {
          unitWarnings.push(`Unknown unit "${record.unit}" — using amount as-is.`);
          normalized = { amount: Number(record.amount), unit: record.unit };
        } else {
          throw err;
        }
      }

      const factorSelection = await selectFactor({
        emissionCategoryId: record.emissionCategoryId,
        activityType: record.emissionCategory.activityType,
        geographyCountry: record.country,
        activityDate,
        factorLibraryId: run.factorLibraryId,
        scope2Method: record.scope2Method ?? undefined,
      });

      if (!factorSelection) {
        // No factor found — skip this record, record a warning
        await prisma.emissionCalculation.create({
          data: {
            organizationId: orgId,
            activityRecordId: record.id,
            calculationRunId,
            emissionFactorId: "no-factor",
            factorLibraryId: run.factorLibraryId,
            factorLibraryVersion,
            methodologyVersionName,
            originalAmount: record.amount,
            originalUnit: record.unit,
            normalizedAmount: normalized.amount,
            normalizedUnit: normalized.unit,
            totalCo2e: 0,
            formula: "No matching emission factor found.",
            warnings: [
              ...unitWarnings,
              `No emission factor found for category ${record.emissionCategory.code}`,
            ],
          },
        });
        continue;
      }

      const { factor, selectionReason, warnings: selectionWarnings = [] } = factorSelection;
      const result = computeCo2e(
        normalized.amount,
        normalized.unit,
        {
          co2: factor.co2 != null ? Number(factor.co2) : null,
          ch4: factor.ch4 != null ? Number(factor.ch4) : null,
          n2o: factor.n2o != null ? Number(factor.n2o) : null,
          co2e: factor.co2e != null ? Number(factor.co2e) : null,
        },
        factor.inputUnit,
        [
          ...unitWarnings,
          ...selectionWarnings,
          ...(selectionReason ? [] : ["Factor selected without clear reason."]),
        ],
      );

      const factorValue = factor.co2e ?? factor.co2;

      await prisma.emissionCalculation.create({
        data: {
          organizationId: orgId,
          activityRecordId: record.id,
          calculationRunId,
          emissionFactorId: factor.id,
          factorLibraryId: run.factorLibraryId,
          factorLibraryVersion,
          methodologyVersionName,
          originalAmount: record.amount,
          originalUnit: record.unit,
          normalizedAmount: normalized.amount,
          normalizedUnit: normalized.unit,
          co2: toDecimal(result.co2),
          ch4: toDecimal(result.ch4),
          n2o: toDecimal(result.n2o),
          totalCo2e: result.totalCo2e,
          selectionReason,
          factorValue: factorValue != null ? toDecimal(Number(factorValue)) : null,
          formula: result.formula,
          warnings: result.warnings,
        },
      });
    }

    // Rebuild DashboardAggregate for this period (live, snapshotId = null)
    await rebuildDashboardAggregates(orgId, run.reportingPeriodId, calculationRunId);

    await prisma.calculationRun.update({
      where: { id: calculationRunId },
      data: { status: "succeeded", finishedAt: new Date() },
    });
  } catch (err) {
    console.error(`[calculations] Error on run ${calculationRunId}:`, err);
    await prisma.calculationRun.update({
      where: { id: calculationRunId },
      data: { status: "failed", finishedAt: new Date() },
    });
    throw err;
  }
}

async function rebuildDashboardAggregates(
  orgId: string,
  reportingPeriodId: string,
  calculationRunId: string,
): Promise<void> {
  // Delete existing live aggregates for this period
  await prisma.dashboardAggregate.deleteMany({
    where: { organizationId: orgId, reportingPeriodId, snapshotId: null },
  });

  // Load all calculations for this run joined with their records
  const calculations = await prisma.emissionCalculation.findMany({
    where: { calculationRunId },
    include: {
      activityRecord: {
        include: {
          emissionCategory: { select: { scope: true } },
        },
      },
    },
  });

  // Group by scope, category, facility, business unit
  type AggKey = { scope: number; emissionCategoryId: string | null; facilityId: string | null; businessUnitId: string | null };
  const groups = new Map<string, { key: AggKey; totalCo2e: number; count: number }>();

  const add = (key: AggKey, co2e: number) => {
    const k = JSON.stringify(key);
    const existing = groups.get(k);
    if (existing) {
      existing.totalCo2e += co2e;
      existing.count += 1;
    } else {
      groups.set(k, { key, totalCo2e: co2e, count: 1 });
    }
  };

  for (const calc of calculations) {
    const record = calc.activityRecord;
    const scope = record.emissionCategory.scope;
    const co2e = Number(calc.totalCo2e);

    // Scope-only aggregate
    add({ scope, emissionCategoryId: null, facilityId: null, businessUnitId: null }, co2e);

    // By category
    add({ scope, emissionCategoryId: record.emissionCategoryId, facilityId: null, businessUnitId: null }, co2e);

    // By facility (if set)
    if (record.facilityId) {
      add({ scope, emissionCategoryId: null, facilityId: record.facilityId, businessUnitId: null }, co2e);
    }

    // By business unit (if set)
    if (record.businessUnitId) {
      add({ scope, emissionCategoryId: null, facilityId: null, businessUnitId: record.businessUnitId }, co2e);
    }
  }

  if (groups.size === 0) return;

  await prisma.dashboardAggregate.createMany({
    data: Array.from(groups.values()).map(({ key, totalCo2e, count }) => ({
      organizationId: orgId,
      reportingPeriodId,
      snapshotId: null,
      scope: key.scope,
      emissionCategoryId: key.emissionCategoryId,
      facilityId: key.facilityId,
      businessUnitId: key.businessUnitId,
      totalCo2e,
      recordCount: count,
    })),
  });
}
