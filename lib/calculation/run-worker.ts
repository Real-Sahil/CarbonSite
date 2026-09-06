import { prisma } from "@/lib/db";
import { calculationLogger } from "@/lib/logger";
import { triggerFacilityRiskFlag } from "@/lib/automation/n8n-client";
import { broadcastDashboardUpdate } from "@/lib/realtime/dashboard-broadcaster";
import { normalizeUnit, convertBetween, UnitError } from "./units";
import { selectFactor, buildFactorCache } from "./factor-selector";
import { computeCo2e, toDecimal } from "./engine";
import { calculateDataQualityScore, calculateConfidenceInterval } from "./quality";
import { assessTemporalRepresentativeness } from "./temporal-representativeness";
import { runMonteCarlo, naiveLinearInterval } from "./monte-carlo";
import { getBoss } from "@/lib/jobs/boss";
import type { ActivityRecord, Scope2Method } from "@prisma/client";

// A single HTTP request (in JOB_PROCESSING_MODE=inline, the only mode that
// works on a Vercel-only deployment — see CLAUDE.md) cannot safely run the
// whole calculation in one uninterruptible pass: at Tier-1-scale record
// counts this measurably exceeds a serverless function's execution timeout,
// and a killed function leaves the run stuck at "running" forever with a
// partial, non-obvious set of immutable EmissionCalculation rows already
// written. Instead, processing is split into bounded chunks:
//
// - CHUNK_TIME_BUDGET_MS caps how long a single chunk (one page-load-and-
//   process pass) runs before yielding, so progress is always persisted
//   at a fine grain.
// - REQUEST_TIME_BUDGET_MS caps how long processCalculationRun() keeps
//   chunking within one invocation before returning early — well inside
//   the route's `maxDuration = 60`. A run that doesn't finish within that
//   budget stays "running" with processedRecordCount/lastProgressAt
//   recorded, safe to resume from another invocation (the client's
//   continue-poll, or the stalled-run sweep) rather than silently hung.
// - LOCK_STALE_MS bounds how long a processing claim is honored after its
//   last heartbeat, so a chunk-holder that crashed or was hard-killed
//   mid-chunk doesn't leave the run permanently unclaimable.
// - BATCH_LOAD_SIZE bounds how many not-yet-processed records are loaded
//   into memory per DB round trip within a chunk.
const CHUNK_TIME_BUDGET_MS = 8_000;
const REQUEST_TIME_BUDGET_MS = 45_000;
const LOCK_STALE_MS = 90_000;
const BATCH_LOAD_SIZE = 500;

type ChunkResult = { done: boolean };

// Atomically claims the right to process the next chunk of this run.
// Fails (returns false) when the run is already terminal (succeeded/failed/
// cancelled), or another invocation holds a still-fresh claim — the two
// cases where this invocation must not touch the run's records.
async function claimRun(calculationRunId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS);
  const result = await prisma.calculationRun.updateMany({
    where: {
      id: calculationRunId,
      status: { in: ["queued", "running"] },
      OR: [{ processingLockedAt: null }, { processingLockedAt: { lt: staleBefore } }],
    },
    data: { processingLockedAt: new Date() },
  });
  return result.count === 1;
}

// Entry point used by dispatch.ts (inline mode) and by the explicit
// continue endpoint / stalled-run sweep for a run that didn't finish
// within its first invocation. Re-entrant and idempotent: calling it again
// for an already-finished run, or one currently claimed elsewhere, is a
// safe no-op.
export async function processCalculationRun(calculationRunId: string, orgId: string): Promise<ChunkResult> {
  if (!(await claimRun(calculationRunId))) {
    return { done: false };
  }

  try {
    const overallDeadline = Date.now() + REQUEST_TIME_BUDGET_MS;
    for (;;) {
      const result = await processOneChunk(calculationRunId, orgId);
      if (result.done) return { done: true };
      if (Date.now() >= overallDeadline) {
        // More work remains but this invocation is out of budget. Refresh
        // the heartbeat so the claim doesn't look instantly stale, then
        // return normally (not an error) — safe to resume later.
        await prisma.calculationRun.update({
          where: { id: calculationRunId },
          data: { processingLockedAt: new Date(), lastProgressAt: new Date() },
        });
        return { done: false };
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "";
    calculationLogger.error("Calculation run failed", {
      calculationRunId,
      orgId,
      error: errorMsg,
      stack: errorStack,
    });
    const reason = errorMsg.slice(0, 500);
    await prisma.calculationRun.update({
      where: { id: calculationRunId },
      data: { status: "failed", finishedAt: new Date(), errorMessage: reason },
    });
    throw err;
  }
}

// Processes one bounded chunk: initializes the run on its first chunk,
// loads and processes a page of not-yet-processed approved records (a
// record already has an EmissionCalculation row for this run — from an
// earlier chunk — is never reprocessed), persists progress, and runs the
// once-only finalization steps when nothing remains.
async function processOneChunk(calculationRunId: string, orgId: string): Promise<ChunkResult> {
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

  const activityRecordWhere = {
    organizationId: orgId,
    reportingPeriodId: run.reportingPeriodId,
    reviewStatus: "approved" as const,
  };

  if (run.totalRecordCount == null) {
    // First chunk: transition to running and size the run.
    const totalRecordCount = await prisma.activityRecord.count({ where: activityRecordWhere });

    if (totalRecordCount === 0) {
      // A run over zero approved records would wipe the live dashboard
      // aggregates and silently show zeros — fail loudly instead.
      const periodsWithRecords = await prisma.activityRecord.findMany({
        where: { organizationId: orgId, reviewStatus: "approved" },
        select: { reportingPeriod: { select: { label: true } } },
        distinct: ["reportingPeriodId"],
        take: 5,
      });
      const hint =
        periodsWithRecords.length > 0
          ? ` Approved records exist in: ${periodsWithRecords.map((r) => r.reportingPeriod.label).join(", ")}.`
          : " No approved records exist in any period — approve records or commit an import first.";
      await prisma.calculationRun.update({
        where: { id: calculationRunId },
        data: {
          status: "failed",
          finishedAt: new Date(),
          errorMessage:
            "No approved activity records found for this reporting period." + hint,
        },
      });
      return { done: true };
    }

    await prisma.calculationRun.update({
      where: { id: calculationRunId },
      data: { status: "running", startedAt: new Date(), totalRecordCount },
    });
  }

  const factorLibraryVersion = `${run.factorLibrary.name} ${run.factorLibrary.version}`;
  const methodologyVersionName = run.methodologyVersion.name;

  // Pre-load all emission factors for this library into memory.
  // This converts ~100k per-record DB queries into a single bulk fetch.
  const factorCache = await buildFactorCache(run.factorLibraryId);

  const chunkDeadline = Date.now() + CHUNK_TIME_BUDGET_MS;

  for (;;) {
    const records = await prisma.activityRecord.findMany({
      where: { ...activityRecordWhere, calculations: { none: { calculationRunId } } },
      include: {
        emissionCategory: { select: { id: true, code: true, activityType: true, scope: true } },
      },
      orderBy: { id: "asc" },
      take: BATCH_LOAD_SIZE,
    });

    if (records.length === 0) break;

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

      if (normalized.amount === 0) {
        unitWarnings.push(
          `Record amount is zero — CO2e will be zero. Verify the source data (record id: ${record.id}).`,
        );
      }

      const factorSelection = await selectFactor(
        {
          emissionCategoryId: record.emissionCategoryId,
          activityType: record.emissionCategory.activityType,
          geographyCountry: record.country,
          activityDate,
          factorLibraryId: run.factorLibraryId,
          scope2Method: record.scope2Method ?? undefined,
          recordUnit: normalized.unit,
          matchHint: [record.fuelType, record.transportMode, record.refrigerantType]
            .filter(Boolean)
            .join(" "),
        },
        factorCache,
      );

      if (!factorSelection) {
        // No factor found — include the record with zero CO2e and a warning
        // instead of failing. (A fake "no-factor" FK value here used to
        // violate the foreign key and abort the entire run.)
        const qualityScore = calculateDataQualityScore({
          record: record as ActivityRecord & { emissionCategory: { scope: number } },
          factorSelection: null,
          unitConverted: false,
          unitConversionComplex: false,
        });

        const confidenceInterval = calculateConfidenceInterval(0, qualityScore.geometricStdDev);

        await prisma.emissionCalculation.create({
          data: {
            organizationId: orgId,
            activityRecordId: record.id,
            calculationRunId,
            emissionFactorId: null,
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
            dataQualityScore: qualityScore.score,
            confidenceIntervalLower: confidenceInterval.lower,
            confidenceIntervalUpper: confidenceInterval.upper,
            pedigreeScores: qualityScore.pedigreeScores as unknown as Record<string, number>,
            geometricStdDev: qualityScore.geometricStdDev,
          },
        });
        continue;
      }

      const { factor, selectionReason, warnings: selectionWarnings = [] } = factorSelection;

      // Reconcile the record's unit with the factor's input unit BEFORE
      // multiplying. Multiplying through a mismatch (2,500 kg × a per-tonne
      // factor) silently overstates by 1000× — refusing with a visible zero
      // is always safer than a wrong number.
      let amountForFactor = normalized.amount;
      let unitWasConverted = false;
      let unitConversionWasComplex = false;

      if (normalized.unit !== factor.inputUnit) {
        const converted = convertBetween(normalized.amount, normalized.unit, factor.inputUnit);
        if (converted != null) {
          amountForFactor = converted;
          unitWasConverted = true;
          unitConversionWasComplex = !["kg", "tonnes", "t"].includes(normalized.unit) ||
            !["kg", "tonnes", "t"].includes(factor.inputUnit);
          unitWarnings.push(
            `Converted ${normalized.amount} ${normalized.unit} to ${converted} ${factor.inputUnit} to match the factor.`,
          );
        } else {
          // Primary unit conversion failed. For transport records that carry a
          // route distance (from postcode OSRM routing), attempt to derive the
          // factor-compatible amount from distanceAmount before giving up.
          let distanceResolved = false;

          if (record.distanceAmount != null && Number(record.distanceAmount) > 0) {
            const distKm = Number(record.distanceAmount);
            const distInputUnit = record.distanceUnit ?? "km";

            // Case 1: Factor expects tonne.km → weight_tonnes × distance_km.
            // This covers freight transport factors (HGV, van, rail, ship).
            const tonneKmAliases = new Set(["tonne.km", "tonne-km", "tkm", "t.km"]);
            if (tonneKmAliases.has(factor.inputUnit)) {
              const weightTonnes = convertBetween(normalized.amount, normalized.unit, "tonnes");
              if (weightTonnes != null) {
                amountForFactor = weightTonnes * distKm;
                unitWasConverted = true;
                unitConversionWasComplex = true;
                unitWarnings.push(
                  `Computed ${amountForFactor.toFixed(4)} tonne.km from ${normalized.amount} ${normalized.unit} × ${distKm} km route distance.`,
                );
                distanceResolved = true;
              }
            }

            // Case 2: Factor expects a pure distance unit (km, vehicle-km, pkm).
            // This covers per-vehicle-trip and passenger-km factors.
            if (!distanceResolved) {
              const distConverted = convertBetween(distKm, distInputUnit, factor.inputUnit);
              if (distConverted != null) {
                amountForFactor = distConverted;
                unitWasConverted = true;
                unitConversionWasComplex = true;
                unitWarnings.push(
                  `Used route distance ${distKm} ${distInputUnit} (as ${factor.inputUnit}) for factor calculation.`,
                );
                distanceResolved = true;
              }
            }
          }

          if (!distanceResolved) {
            // Cannot match the factor's unit — record zero CO2e with a warning
            // so the run completes rather than aborting on one bad record.
            const qualityScore = calculateDataQualityScore({
              record: record as ActivityRecord & { emissionCategory: { scope: number } },
              factorSelection,
              unitConverted: true,
              unitConversionComplex: true,
            });
            const confidenceInterval = calculateConfidenceInterval(0, qualityScore.geometricStdDev);

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
                totalCo2e: 0,
                selectionReason,
                formula: `Cannot convert ${normalized.unit} to the factor's input unit (${factor.inputUnit}) — not calculated.`,
                warnings: [
                  ...unitWarnings,
                  `Record unit "${normalized.unit}" is incompatible with factor input unit "${factor.inputUnit}". Correct the record's unit or import a matching factor.`,
                ],
                dataQualityScore: qualityScore.score,
                confidenceIntervalLower: confidenceInterval.lower,
                confidenceIntervalUpper: confidenceInterval.upper,
                pedigreeScores: qualityScore.pedigreeScores as unknown as Record<string, number>,
                geometricStdDev: qualityScore.geometricStdDev,
              },
            });
            continue;
          }
        }
      }

      let result: ReturnType<typeof computeCo2e>;
      try {
        result = computeCo2e(
          amountForFactor,
          factor.inputUnit,
          {
            co2: factor.co2 != null ? Number(factor.co2) : null,
            ch4: factor.ch4 != null ? Number(factor.ch4) : null,
            n2o: factor.n2o != null ? Number(factor.n2o) : null,
            co2e: factor.co2e != null ? Number(factor.co2e) : null,
            biogenicCo2: factor.biogenicCo2 != null ? Number(factor.biogenicCo2) : null,
          },
          factor.inputUnit,
          [
            ...unitWarnings,
            ...selectionWarnings,
            ...(selectionReason ? [] : ["Factor selected without clear reason."]),
          ],
        );
      } catch (calcErr) {
        const errMsg = calcErr instanceof Error ? calcErr.message : "Calculation error";
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
            co2: null,
            ch4: null,
            n2o: null,
            totalCo2e: 0,
            selectionReason,
            factorValue: null,
            formula: `Error: ${errMsg}`,
            warnings: [errMsg],
            dataQualityScore: 0,
            confidenceIntervalLower: null,
            confidenceIntervalUpper: null,
          },
        });
        continue;
      }

      const factorValue = factor.co2e ?? factor.co2;

      const qualityScore = calculateDataQualityScore({
        record: record as ActivityRecord & { emissionCategory: { scope: number } },
        factorSelection,
        unitConverted: unitWasConverted,
        unitConversionComplex: unitConversionWasComplex,
      });

      const confidenceInterval = calculateConfidenceInterval(
        result.totalCo2e,
        qualityScore.geometricStdDev,
      );

      const temporalRepresentativeness = assessTemporalRepresentativeness({
        factorEffectiveStartDate: factor.effectiveStartDate,
        factorEffectiveEndDate: factor.effectiveEndDate,
        activityDate,
      });
      if (temporalRepresentativeness.warning) {
        result.warnings.push(temporalRepresentativeness.warning);
      }

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
          biogenicCo2e: toDecimal(result.biogenicCo2e),
          totalCo2e: result.totalCo2e,
          selectionReason,
          factorValue: factorValue != null ? toDecimal(Number(factorValue)) : null,
          formula: result.formula,
          warnings: result.warnings,
          dataQualityScore: qualityScore.score,
          confidenceIntervalLower: toDecimal(confidenceInterval.lower),
          confidenceIntervalUpper: toDecimal(confidenceInterval.upper),
          pedigreeScores: qualityScore.pedigreeScores as unknown as Record<string, number>,
          geometricStdDev: qualityScore.geometricStdDev,
          temporalRepresentativenessYears:
            temporalRepresentativeness.yearsGap != null
              ? toDecimal(temporalRepresentativeness.yearsGap)
              : null,
        },
      });
    }

    await prisma.calculationRun.update({
      where: { id: calculationRunId },
      data: {
        processedRecordCount: { increment: records.length },
        lastProgressAt: new Date(),
        processingLockedAt: new Date(),
      },
    });

    if (Date.now() >= chunkDeadline) {
      // Chunk budget spent but a full page was still available — more
      // records remain. Yield; the caller decides whether to keep looping
      // (still within its own overall budget) or return for now.
      return { done: false };
    }
  }

  // The page loop above only exits here (never via the early return) once
  // a page comes back empty — every approved record now has a calculation
  // for this run. Safe to run the once-only finalization steps.

  // Rebuild DashboardAggregate for this period (live, snapshotId = null)
  await rebuildDashboardAggregates(orgId, run.reportingPeriodId, calculationRunId);

  // Monte Carlo uncertainty propagation for the run's inventory total
  await computeAndPersistUncertainty(orgId, calculationRunId);

  // Broadcast dashboard update to connected SSE clients
  try {
    await broadcastDashboardUpdate(orgId, calculationRunId, run.reportingPeriodId);
  } catch (err) {
    calculationLogger.warn("Failed to broadcast dashboard update", {
      calculationRunId,
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Feature 4: Auto-create supplier data requests for high-uncertainty Scope 3 records
  await autoCreateSupplierDataRequests(
    orgId,
    run.reportingPeriodId,
    calculationRunId,
    run.triggeredByUserId,
  );

  await prisma.calculationRun.update({
    where: { id: calculationRunId },
    data: { status: "succeeded", finishedAt: new Date(), errorMessage: null },
  });

  // Enqueue dbt transformation for immutable fact table building
  const boss = await getBoss();
  await boss
    .send(
      "dbt-transform-jobs",
      { calculationRunId, organizationId: orgId },
      { retryLimit: 2, retryDelay: 30 },
    )
    .catch((err: Error) => calculationLogger.warn("Failed to enqueue dbt transformation", { err }));

  // Trigger n8n workflow for facility risk flagging
  await triggerFacilityRiskFlag(orgId, calculationRunId).catch((err) =>
    console.error(`[calculations] Failed to trigger n8n facility risk workflow:`, err)
  );

  return { done: true };
}

async function rebuildDashboardAggregates(
  orgId: string,
  reportingPeriodId: string,
  calculationRunId: string,
): Promise<void> {
  // Load reporting period for intensity metric calculations
  const reportingPeriod = await prisma.reportingPeriod.findFirst({
    where: { id: reportingPeriodId, organizationId: orgId },
    select: {
      revenueAmount: true,
      revenueCurrency: true,
      fteCount: true,
      facilityAreaM2: true,
    },
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

  // Group by scope, category, facility, business unit, and scope2Method for Scope 2
  type AggKey = {
    scope: number;
    scope2Method: Scope2Method | null | undefined;
    emissionCategoryId: string | null;
    facilityId: string | null;
    businessUnitId: string | null;
  };
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
    // For Scope 2, track both location-based and market-based separately
    const scope2Method = scope === 2 ? (record.scope2Method ?? "location_based") : undefined;

    // Scope-only aggregate
    add({ scope, scope2Method, emissionCategoryId: null, facilityId: null, businessUnitId: null }, co2e);

    // By category
    add({ scope, scope2Method, emissionCategoryId: record.emissionCategoryId, facilityId: null, businessUnitId: null }, co2e);

    // By facility (if set)
    if (record.facilityId) {
      add({ scope, scope2Method, emissionCategoryId: null, facilityId: record.facilityId, businessUnitId: null }, co2e);
    }

    // By business unit (if set)
    if (record.businessUnitId) {
      add({ scope, scope2Method, emissionCategoryId: null, facilityId: null, businessUnitId: record.businessUnitId }, co2e);
    }
  }

  // Feature 5: Compute intensity metrics for multi-year trend analysis
  const computeIntensity = (totalCo2e: number) => {
    return {
      intensityPerRevenueUnit: reportingPeriod?.revenueAmount
        ? toDecimal(Number(totalCo2e) / Number(reportingPeriod.revenueAmount))
        : null,
      intensityPerFte: reportingPeriod?.fteCount
        ? toDecimal(Number(totalCo2e) / Number(reportingPeriod.fteCount))
        : null,
      intensityPerM2: reportingPeriod?.facilityAreaM2
        ? toDecimal(Number(totalCo2e) / Number(reportingPeriod.facilityAreaM2))
        : null,
    };
  };

  // Atomic swap: delete stale rows and insert fresh ones in one transaction so
  // the dashboard is never in a partially-empty state between the two writes.
  await prisma.$transaction(async (tx) => {
    await tx.dashboardAggregate.deleteMany({
      where: { organizationId: orgId, reportingPeriodId, snapshotId: null },
    });

    if (groups.size === 0) return;

    await tx.dashboardAggregate.createMany({
      data: Array.from(groups.values()).map(({ key, totalCo2e, count }) => ({
        organizationId: orgId,
        reportingPeriodId,
        snapshotId: null,
        scope: key.scope,
        scope2Method: key.scope2Method,
        emissionCategoryId: key.emissionCategoryId,
        facilityId: key.facilityId,
        businessUnitId: key.businessUnitId,
        totalCo2e,
        recordCount: count,
        ...computeIntensity(Number(totalCo2e)),
      })),
    });
  });
}

async function computeAndPersistUncertainty(
  orgId: string,
  calculationRunId: string,
): Promise<void> {
  const calculations = await prisma.emissionCalculation.findMany({
    where: { calculationRunId },
    select: {
      totalCo2e: true,
      geometricStdDev: true,
      confidenceIntervalLower: true,
      confidenceIntervalUpper: true,
      activityRecord: { select: { emissionCategory: { select: { scope: true } } } },
    },
  });

  if (calculations.length === 0) return;

  const toMonteCarloInput = (rows: typeof calculations) =>
    rows.map((c) => ({
      totalCo2e: Number(c.totalCo2e),
      // A record with no pedigree-derived GSD (e.g. a calculation error
      // fallback) is treated as certain — it contributes its value with no
      // simulated spread rather than being dropped from the total.
      geometricStdDev: c.geometricStdDev != null ? Number(c.geometricStdDev) : 1,
    }));

  const toNaiveInput = (rows: typeof calculations) =>
    rows.map((c) => ({
      lower: c.confidenceIntervalLower != null ? Number(c.confidenceIntervalLower) : Number(c.totalCo2e),
      upper: c.confidenceIntervalUpper != null ? Number(c.confidenceIntervalUpper) : Number(c.totalCo2e),
    }));

  const totalCo2e = calculations.reduce((sum, c) => sum + Number(c.totalCo2e), 0);
  const overall = runMonteCarlo(toMonteCarloInput(calculations), { seed: 42 });
  const naive = naiveLinearInterval(toNaiveInput(calculations));

  const scopeBreakdown: Record<string, { mean: number; p2_5: number; p97_5: number }> = {};
  for (const scope of [1, 2, 3]) {
    const scopeRows = calculations.filter((c) => c.activityRecord.emissionCategory.scope === scope);
    if (scopeRows.length === 0) continue;
    const scopeResult = runMonteCarlo(toMonteCarloInput(scopeRows), { seed: 42 });
    scopeBreakdown[String(scope)] = {
      mean: scopeResult.mean,
      p2_5: scopeResult.p2_5,
      p97_5: scopeResult.p97_5,
    };
  }

  await prisma.calculationUncertaintyResult.upsert({
    where: { calculationRunId },
    create: {
      organizationId: orgId,
      calculationRunId,
      totalCo2e,
      monteCarloMean: overall.mean,
      monteCarloMedian: overall.median,
      monteCarloP2_5: overall.p2_5,
      monteCarloP97_5: overall.p97_5,
      naiveIntervalLower: naive.lower,
      naiveIntervalUpper: naive.upper,
      iterations: overall.iterations,
      seed: overall.seed,
      recordCount: calculations.length,
      scopeBreakdown,
    },
    update: {
      totalCo2e,
      monteCarloMean: overall.mean,
      monteCarloMedian: overall.median,
      monteCarloP2_5: overall.p2_5,
      monteCarloP97_5: overall.p97_5,
      naiveIntervalLower: naive.lower,
      naiveIntervalUpper: naive.upper,
      iterations: overall.iterations,
      seed: overall.seed,
      recordCount: calculations.length,
      scopeBreakdown,
    },
  });
}

async function autoCreateSupplierDataRequests(
  orgId: string,
  reportingPeriodId: string,
  calculationRunId: string,
  triggeredByUserId: string,
): Promise<void> {
  // Feature 4: Spend-based → Activity-based upgrade suggestions
  // Identify Scope 3 records with high uncertainty (data_quality_score < 40)
  // and auto-create SupplierDataRequest for supplier engagement

  const highUncertaintyRecords = await prisma.emissionCalculation.findMany({
    where: {
      calculationRunId,
      activityRecord: {
        emissionCategory: { scope: 3 },
      },
      dataQualityScore: { lt: 40 }, // High uncertainty threshold
    },
    include: {
      activityRecord: {
        include: {
          emissionCategory: { select: { code: true } },
        },
      },
    },
  });

  if (highUncertaintyRecords.length === 0) return;

  // Group by supplier and category to avoid duplicate requests
  type UpgradeKey = { supplierName: string | null; categoryCode: string };
  const upgrades = new Map<string, { supplierName: string | null; categoryCode: string }>();

  for (const record of highUncertaintyRecords) {
    const key: UpgradeKey = {
      supplierName: record.activityRecord.supplierName,
      categoryCode: record.activityRecord.emissionCategory.code,
    };
    const k = JSON.stringify(key);
    if (!upgrades.has(k)) {
      upgrades.set(k, key);
    }
  }

  // For each supplier/category combination, check if request already exists
  // and create if needed. Only create if we can match supplier email.
  for (const { supplierName, categoryCode } of upgrades.values()) {
    // Skip if no supplier name — can't send to an unknown party
    if (!supplierName) continue;

    // Check if request already exists for this supplier/category/period
    const existing = await prisma.supplierDataRequest.findFirst({
      where: {
        organizationId: orgId,
        reportingPeriodId,
        categoryCode,
        supplierName,
        status: { in: ["sent", "opened"] }, // Only check active requests
      },
    });

    if (existing) continue; // Already requested, skip

    // Try to find supplier email from SupplierInvite
    const supplierInvite = await prisma.supplierInvite.findFirst({
      where: {
        organizationId: orgId,
        companyName: supplierName,
      },
      select: { email: true, companyName: true },
    });

    if (!supplierInvite) continue; // Can't auto-request without email

    // Create SupplierDataRequest
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    try {
      await prisma.supplierDataRequest.create({
        data: {
          organizationId: orgId,
          reportingPeriodId,
          supplierEmail: supplierInvite.email,
          supplierName: supplierInvite.companyName ?? undefined,
          categoryCode,
          expiresAt,
          notes:
            "Auto-generated request: High-uncertainty spend-based data detected. Please provide activity-based details.",
          createdByUserId: triggeredByUserId,
        },
      });

      // Note: Email sending would happen here in production, but omitted to avoid
      // hard dependency on Resend during calc runs. Dashboard UI can prompt admins
      // to send emails manually or integrate async email job.
    } catch (err) {
      // Log but don't fail the calculation run if request creation fails
      calculationLogger.warn("Failed to create SupplierDataRequest", {
        supplierName,
        categoryCode,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
