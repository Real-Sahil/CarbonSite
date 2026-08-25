// Ephemeral calculation runs for what-if scenarios.
// Reruns calculation pipeline against hypothetical ActivityRecord modifications,
// persisting results to ScenarioDraft (never to EmissionCalculation).

import { prisma } from "@/lib/db";
import { normalizeUnit, convertBetween, UnitError } from "./units";
import { selectFactor } from "./factor-selector";
import { computeCo2e, toDecimal } from "./engine";
import { calculateDataQualityScore, calculateConfidenceInterval } from "./quality";
import type { ActivityRecord } from "@prisma/client";

export interface ScenarioModification {
  activityRecordId: string;
  amountOverride?: number;
  unitOverride?: string;
  /** Date override for factor selection */
  activityDateOverride?: Date;
}

export async function runScenario(
  calculationRunId: string,
  orgId: string,
  modifications: Map<string, ScenarioModification>,
  userId: string,
): Promise<{ scenarioRunId: string; draftCount: number }> {
  // Create ScenarioRun — expires 1 hour from now
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  const scenarioRun = await prisma.scenarioRun.create({
    data: {
      organizationId: orgId,
      calculationRunId,
      createdByUserId: userId,
      expiresAt,
    },
  });

  const run = await prisma.calculationRun.findUniqueOrThrow({
    where: { id: calculationRunId },
    include: {
      factorLibrary: { select: { version: true, name: true } },
      methodologyVersion: { select: { name: true } },
    },
  });

  // Load approved records
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

  // Process each record with optional modifications
  for (const record of records) {
    const mod = modifications.get(record.id);

    // Apply modifications if provided, otherwise use original
    const amount = mod?.amountOverride ?? Number(record.amount);
    const unit = mod?.unitOverride ?? record.unit;
    const activityDate = mod?.activityDateOverride ?? record.activityDate ?? record.startDate ?? new Date();

    let normalized: ReturnType<typeof normalizeUnit>;
    const unitWarnings: string[] = [];
    try {
      normalized = normalizeUnit(amount, unit);
    } catch (err) {
      if (err instanceof UnitError) {
        unitWarnings.push(`Unknown unit "${unit}" — using amount as-is.`);
        normalized = { amount, unit };
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
      recordUnit: normalized.unit,
      matchHint: [record.fuelType, record.transportMode, record.refrigerantType]
        .filter(Boolean)
        .join(" "),
    });

    if (!factorSelection) {
      const qualityScore = calculateDataQualityScore({
        record: record as any,
        factorSelection: null,
        unitConverted: false,
        unitConversionComplex: false,
      });
      const confidenceInterval = calculateConfidenceInterval(0, qualityScore.score);

      await prisma.scenarioDraft.create({
        data: {
          organizationId: orgId,
          scenarioRunId: scenarioRun.id,
          activityRecordId: record.id,
          emissionFactorId: null,
          originalAmount: amount,
          originalUnit: unit,
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

        await prisma.scenarioDraft.create({
          data: {
            organizationId: orgId,
            scenarioRunId: scenarioRun.id,
            activityRecordId: record.id,
            emissionFactorId: factor.id,
            originalAmount: amount,
            originalUnit: unit,
            normalizedAmount: normalized.amount,
            normalizedUnit: normalized.unit,
            totalCo2e: 0,
            selectionReason,
            formula: `Cannot convert ${normalized.unit} to the factor's input unit (${factor.inputUnit}) — not calculated.`,
            warnings: [
              ...unitWarnings,
              `Record unit "${normalized.unit}" is incompatible with factor input unit "${factor.inputUnit}".`,
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

    await prisma.scenarioDraft.create({
      data: {
        organizationId: orgId,
        scenarioRunId: scenarioRun.id,
        activityRecordId: record.id,
        emissionFactorId: factor.id,
        originalAmount: amount,
        originalUnit: unit,
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

  // Count the drafts created
  const draftCount = await prisma.scenarioDraft.count({
    where: { scenarioRunId: scenarioRun.id },
  });

  return { scenarioRunId: scenarioRun.id, draftCount };
}
