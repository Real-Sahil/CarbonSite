// Water & waste (ESRS E3/E5) support for the calculation layer.
//
// Water never enters this file's GHG machinery: WaterRecord has no linked
// ActivityRecord and no EmissionCalculation, because water withdrawal/
// discharge/consumption has no GHG Protocol scope. It only needs a rollup
// into EnvironmentalMetricAggregate.
//
// Waste is different: it already has a real GHG angle (Scope 3 Category 5,
// EmissionCategory "s3-waste"). syncWasteRecordCalculation() creates or
// updates a linked ActivityRecord and runs it through the same
// factor-selection/CO2e engine every other category uses (selectFactor(),
// computeCo2e()) instead of a hardcoded factor table, fixing the bug where
// waste CO2e never reached the dashboard or a published report.
//
// Neither path touches lib/calculation/run-worker.ts: a WasteRecord save
// calculates just its own one record, not the whole org/period the way a
// CalculationRun does, so it must not reuse processCalculationRun() itself.

import { prisma } from "@/lib/db";
import { normalizeUnit, UnitError } from "./units";
import { selectFactor, buildFactorCache } from "./factor-selector";
import { computeCo2e } from "./engine";
import { calculateDataQualityScore, calculateConfidenceInterval } from "./quality";
import type { ActivityRecord, EnvironmentalMetricType } from "@prisma/client";

const WASTE_CATEGORY_CODE = "s3-waste";

async function getDefaultFactorLibraryAndMethodology() {
  const [factorLibrary, methodologyVersion] = await Promise.all([
    prisma.factorLibrary.findFirst({ orderBy: { publishedAt: "desc" } }),
    prisma.methodologyVersion.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);
  if (!factorLibrary || !methodologyVersion) {
    throw new Error("No factor library or methodology version seeded — cannot calculate waste CO2e.");
  }
  return { factorLibrary, methodologyVersion };
}

/**
 * Creates/updates the ActivityRecord (category s3-waste) a WasteRecord
 * drives and calculates its CO2e through the real engine. No-ops (returns
 * null) until the record has a facility + reporting period assigned —
 * true for pre-backfill legacy rows and briefly during creation.
 */
export async function syncWasteRecordCalculation(
  wasteRecordId: string,
  actorUserId: string,
): Promise<{ co2eTonnes: number } | null> {
  const wasteRecord = await prisma.wasteRecord.findUniqueOrThrow({ where: { id: wasteRecordId } });
  if (!wasteRecord.facilityId || !wasteRecord.reportingPeriodId) return null;

  const category = await prisma.emissionCategory.findUniqueOrThrow({
    where: { code: WASTE_CATEGORY_CODE },
  });
  const { factorLibrary, methodologyVersion } = await getDefaultFactorLibraryAndMethodology();

  const activityDate = wasteRecord.recordedAt;
  const amount = Number(wasteRecord.weightTonnes);
  const unit = "tonnes";
  const sourceDescription = `${wasteRecord.wasteType} (${wasteRecord.disposalRoute})`;

  let activityRecordId = wasteRecord.activityRecordId;
  if (activityRecordId) {
    await prisma.activityRecord.update({
      where: { id: activityRecordId },
      data: {
        amount,
        unit,
        activityDate,
        facilityId: wasteRecord.facilityId,
        reportingPeriodId: wasteRecord.reportingPeriodId,
        sourceDescription,
      },
    });
  } else {
    const created = await prisma.activityRecord.create({
      data: {
        organizationId: wasteRecord.organizationId,
        reportingPeriodId: wasteRecord.reportingPeriodId,
        emissionCategoryId: category.id,
        facilityId: wasteRecord.facilityId,
        activityDate,
        amount,
        unit,
        sourceDescription,
        // A waste transfer/disposal note is a third-party document
        // recording a quantity, the same shape as an invoiced spend record.
        dataOrigin: "invoiced",
        reviewStatus: "approved",
        evidenceStatus: "missing",
        createdByUserId: actorUserId,
      },
    });
    activityRecordId = created.id;
    await prisma.wasteRecord.update({
      where: { id: wasteRecordId },
      data: { activityRecordId },
    });
  }

  const activityRecord = await prisma.activityRecord.findUniqueOrThrow({
    where: { id: activityRecordId },
    include: { emissionCategory: { select: { id: true, code: true, activityType: true, scope: true } } },
  });

  let normalized: ReturnType<typeof normalizeUnit>;
  try {
    normalized = normalizeUnit(amount, unit);
  } catch (err) {
    if (!(err instanceof UnitError)) throw err;
    normalized = { amount, unit };
  }

  const factorCache = await buildFactorCache(factorLibrary.id);
  const factorSelection = await selectFactor(
    {
      emissionCategoryId: category.id,
      activityType: category.activityType,
      geographyCountry: null,
      activityDate,
      factorLibraryId: factorLibrary.id,
      recordUnit: normalized.unit,
      matchHint: wasteRecord.disposalRoute,
    },
    factorCache,
  );

  // One dedicated CalculationRun per save — this is a single-record
  // recalculation, not a period-wide run, so it must not go through
  // processCalculationRun() (which would reprocess every other record in
  // the period). CalculationRun rows are cheap and this mirrors the
  // platform's "recalculation creates a new run" convention.
  const run = await prisma.calculationRun.create({
    data: {
      organizationId: wasteRecord.organizationId,
      reportingPeriodId: wasteRecord.reportingPeriodId,
      methodologyVersionId: methodologyVersion.id,
      factorLibraryId: factorLibrary.id,
      triggeredByUserId: actorUserId,
      status: "running",
      startedAt: new Date(),
    },
  });

  const factorLibraryVersion = `${factorLibrary.name} ${factorLibrary.version}`;
  let totalCo2e = 0;

  if (!factorSelection) {
    await prisma.emissionCalculation.create({
      data: {
        organizationId: wasteRecord.organizationId,
        activityRecordId,
        calculationRunId: run.id,
        emissionFactorId: null,
        factorLibraryId: factorLibrary.id,
        factorLibraryVersion,
        methodologyVersionName: methodologyVersion.name,
        originalAmount: amount,
        originalUnit: unit,
        normalizedAmount: normalized.amount,
        normalizedUnit: normalized.unit,
        totalCo2e: 0,
        formula: "No matching emission factor found for s3-waste.",
        warnings: [`No emission factor found for disposal route "${wasteRecord.disposalRoute}".`],
        dataQualityScore: 20,
      },
    });
  } else {
    const { factor, selectionReason, warnings: selectionWarnings = [] } = factorSelection;
    const result = computeCo2e(
      normalized.amount,
      normalized.unit,
      {
        co2: factor.co2 != null ? Number(factor.co2) : null,
        ch4: factor.ch4 != null ? Number(factor.ch4) : null,
        n2o: factor.n2o != null ? Number(factor.n2o) : null,
        co2e: factor.co2e != null ? Number(factor.co2e) : null,
        biogenicCo2: factor.biogenicCo2 != null ? Number(factor.biogenicCo2) : null,
      },
      factor.inputUnit,
      selectionWarnings,
    );

    const qualityScore = calculateDataQualityScore({
      record: activityRecord as ActivityRecord & { emissionCategory: { scope: number } },
      factorSelection,
      unitConverted: normalized.unit !== factor.inputUnit,
      unitConversionComplex: false,
    });
    const confidenceInterval = calculateConfidenceInterval(result.totalCo2e, qualityScore.geometricStdDev);

    await prisma.emissionCalculation.create({
      data: {
        organizationId: wasteRecord.organizationId,
        activityRecordId,
        calculationRunId: run.id,
        emissionFactorId: factor.id,
        factorLibraryId: factorLibrary.id,
        factorLibraryVersion,
        methodologyVersionName: methodologyVersion.name,
        originalAmount: amount,
        originalUnit: unit,
        normalizedAmount: normalized.amount,
        normalizedUnit: normalized.unit,
        co2: result.co2,
        ch4: result.ch4,
        n2o: result.n2o,
        totalCo2e: result.totalCo2e,
        selectionReason,
        factorValue: factor.co2e ?? factor.co2,
        formula: result.formula,
        warnings: result.warnings,
        dataQualityScore: qualityScore.score,
        confidenceIntervalLower: confidenceInterval.lower,
        confidenceIntervalUpper: confidenceInterval.upper,
        pedigreeScores: qualityScore.pedigreeScores as unknown as Record<string, number>,
        geometricStdDev: qualityScore.geometricStdDev,
      },
    });
    totalCo2e = result.totalCo2e;
  }

  await prisma.calculationRun.update({
    where: { id: run.id },
    data: { status: "succeeded", finishedAt: new Date() },
  });

  const co2eTonnes = totalCo2e / 1000;
  await prisma.wasteRecord.update({
    where: { id: wasteRecordId },
    data: { co2eTonnes },
  });

  return { co2eTonnes };
}

const ENV_METRIC_UNIT: Record<EnvironmentalMetricType, string> = {
  water_withdrawal: "m3",
  water_discharge: "m3",
  water_consumption: "m3",
  waste_generated: "tonnes",
  waste_diverted: "tonnes",
  waste_hazardous: "tonnes",
};

function computeIntensity(total: number, denominator: number | null | undefined) {
  if (denominator == null || Number(denominator) === 0) return null;
  return total / Number(denominator);
}

/**
 * Rebuilds EnvironmentalMetricAggregate rows for one org/reporting period —
 * the "never raw-aggregate at request time" rule the rest of the dashboard
 * follows, applied to water/waste. Cheap: no factor selection involved,
 * just a rollup, so it runs synchronously after every WaterRecord save and
 * every WasteRecord recalculation rather than needing a background job.
 */
export async function rebuildEnvironmentalMetricAggregates(
  organizationId: string,
  reportingPeriodId: string,
): Promise<void> {
  const [period, waterRecords, wasteRecords] = await Promise.all([
    prisma.reportingPeriod.findUniqueOrThrow({ where: { id: reportingPeriodId } }),
    prisma.waterRecord.findMany({ where: { organizationId, reportingPeriodId } }),
    prisma.wasteRecord.findMany({ where: { organizationId, reportingPeriodId } }),
  ]);

  type Bucket = { total: number; count: number; facilityId: string | null };
  const buckets = new Map<string, Bucket>();

  function addTo(metricType: EnvironmentalMetricType, facilityId: string | null, value: number) {
    const key = `${metricType}:${facilityId ?? "org"}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.total += value;
      existing.count += 1;
    } else {
      buckets.set(key, { total: value, count: 1, facilityId });
    }
  }

  for (const w of waterRecords) {
    const metricType: EnvironmentalMetricType =
      w.metricType === "withdrawal"
        ? "water_withdrawal"
        : w.metricType === "discharge"
          ? "water_discharge"
          : "water_consumption";
    addTo(metricType, w.facilityId, Number(w.volumeM3));
  }

  for (const w of wasteRecords) {
    addTo("waste_generated", w.facilityId ?? null, Number(w.weightTonnes));
    if (w.disposalRoute !== "landfill_mixed" && !w.disposalRoute.startsWith("landfill")) {
      addTo("waste_diverted", w.facilityId ?? null, Number(w.weightTonnes));
    }
    if (w.hazardous) {
      addTo("waste_hazardous", w.facilityId ?? null, Number(w.weightTonnes));
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.environmentalMetricAggregate.deleteMany({
      where: { organizationId, reportingPeriodId, snapshotId: null },
    });
    for (const [key, bucket] of buckets) {
      const metricType = key.split(":")[0] as EnvironmentalMetricType;
      await tx.environmentalMetricAggregate.create({
        data: {
          organizationId,
          reportingPeriodId,
          metricType,
          facilityId: bucket.facilityId,
          totalValue: bucket.total,
          unit: ENV_METRIC_UNIT[metricType],
          recordCount: bucket.count,
          intensityPerRevenueUnit: computeIntensity(bucket.total, period.revenueAmount ? Number(period.revenueAmount) : null),
          intensityPerFte: computeIntensity(bucket.total, period.fteCount ? Number(period.fteCount) : null),
          intensityPerM2: computeIntensity(bucket.total, period.facilityAreaM2 ? Number(period.facilityAreaM2) : null),
        },
      });
    }
  });
}
