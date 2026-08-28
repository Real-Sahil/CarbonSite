import { prisma } from "@/lib/db";
import { calculationLogger } from "@/lib/logger";
import { triggerFacilityRiskFlag } from "@/lib/automation/n8n-client";
import { normalizeUnit, convertBetween, UnitError } from "./units";
import { selectFactor, buildFactorCache } from "./factor-selector";
import { computeCo2e, toDecimal } from "./engine";
import { calculateDataQualityScore, calculateConfidenceInterval } from "./quality";
import type { Scope2Method } from "@prisma/client";

export async function processCalculationRun(calculationRunId: string, orgId: string): Promise<void> {
  try {
    await prisma.calculationRun.update({
      where: { id: calculationRunId },
      data: { status: "running", startedAt: new Date() },
    });
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
        emissionCategory: { select: { id: true, code: true, activityType: true, scope: true } },
      },
    });

    const factorLibraryVersion = `${run.factorLibrary.name} ${run.factorLibrary.version}`;
    const methodologyVersionName = run.methodologyVersion.name;

    // Pre-load all emission factors for this library into memory.
    // This converts ~100k per-record DB queries into a single bulk fetch.
    const factorCache = await buildFactorCache(run.factorLibraryId);

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
          record: record as any,
          factorSelection: null,
          unitConverted: false,
          unitConversionComplex: false,
        });

        const confidenceInterval = calculateConfidenceInterval(0, qualityScore.score);

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
        if (converted == null) {
          const qualityScore = calculateDataQualityScore({
            record: record as any,
            factorSelection,
            unitConverted: true,
            unitConversionComplex: true,
          });
          const confidenceInterval = calculateConfidenceInterval(0, qualityScore.score);

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
            },
          });
          continue;
        }
        amountForFactor = converted;
        unitWasConverted = true;
        unitConversionWasComplex = !["kg", "tonnes", "t"].includes(normalized.unit) ||
          !["kg", "tonnes", "t"].includes(factor.inputUnit);
        unitWarnings.push(
          `Converted ${normalized.amount} ${normalized.unit} to ${converted} ${factor.inputUnit} to match the factor.`,
        );
      }

      const result = computeCo2e(
        amountForFactor,
        factor.inputUnit,
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

      const qualityScore = calculateDataQualityScore({
        record: record as any,
        factorSelection,
        unitConverted: unitWasConverted,
        unitConversionComplex: unitConversionWasComplex,
      });

      const confidenceInterval = calculateConfidenceInterval(
        result.totalCo2e,
        qualityScore.score,
      );

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
          dataQualityScore: qualityScore.score,
          confidenceIntervalLower: toDecimal(confidenceInterval.lower),
          confidenceIntervalUpper: toDecimal(confidenceInterval.upper),
        },
      });
    }

    // A run over zero approved records would wipe the live dashboard
    // aggregates and silently show zeros — fail loudly instead.
    if (records.length === 0) {
      // Surface which periods DO have approved records so the user can pick the right one.
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
      return;
    }

    // Rebuild DashboardAggregate for this period (live, snapshotId = null)
    await rebuildDashboardAggregates(orgId, run.reportingPeriodId, calculationRunId);

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

    // Trigger n8n workflow for facility risk flagging
    await triggerFacilityRiskFlag(orgId, calculationRunId).catch((err) =>
      console.error(`[calculations] Failed to trigger n8n facility risk workflow:`, err)
    );
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

async function rebuildDashboardAggregates(
  orgId: string,
  reportingPeriodId: string,
  calculationRunId: string,
): Promise<void> {
  // Delete existing live aggregates for this period
  await prisma.dashboardAggregate.deleteMany({
    where: { organizationId: orgId, reportingPeriodId, snapshotId: null },
  });

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

  if (groups.size === 0) return;

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

  await prisma.dashboardAggregate.createMany({
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
