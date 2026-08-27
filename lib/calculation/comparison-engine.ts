// Parallel calculation runner for PoC validation
// Runs both current engine and ghg-calculator, compares results

import { computeCo2e, type CalculationResult, type GasValues } from "./engine";
import type { GhgCalculatorClient } from "./ghg-calculator-client";

export type ComparisonResult = {
  currentEngine: CalculationResult;
  ghgCalculator: {
    totalCo2e: number;
    formula: string;
  } | null;
  deviance: {
    absoluteDifference: number;
    percentageDifference: number; // (ghg - current) / current × 100
    withinTolerance: boolean;
  } | null;
  error?: string;
};

export async function compareCalculations(
  amount: number,
  unit: string,
  factor: GasValues,
  ghgClient?: GhgCalculatorClient,
): Promise<ComparisonResult> {
  // Run current engine
  const currentResult = computeCo2e(amount, unit, factor, unit);

  // Try ghg-calculator if available
  let ghgResult = null;
  let error: string | undefined;

  if (ghgClient?.isEnabled()) {
    try {
      const ghgResp = await ghgClient.calculate({
        amount,
        unit,
        scope: "scope1",
        category: "unknown",
        date: new Date().toISOString(),
      });
      ghgResult = {
        totalCo2e: ghgResp.totalCo2e,
        formula: ghgResp.formula,
      };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  // Calculate deviance
  let deviance = null;
  if (ghgResult) {
    const absDiff = Math.abs(ghgResult.totalCo2e - currentResult.totalCo2e);
    const pctDiff = (absDiff / (currentResult.totalCo2e || 1)) * 100;
    deviance = {
      absoluteDifference: absDiff,
      percentageDifference: pctDiff,
      withinTolerance: pctDiff < 1.0, // <1% tolerance
    };
  }

  return {
    currentEngine: currentResult,
    ghgCalculator: ghgResult,
    deviance,
    error,
  };
}

export type AggregateMetrics = {
  totalRecords: number;
  successfulComparisons: number;
  failedComparisons: number;
  avgDeviance: number;
  maxDeviance: number;
  withinToleranceCount: number;
  toleranceRate: number; // % within 1%
};

export function aggregateComparisons(
  results: ComparisonResult[],
): AggregateMetrics {
  const withDeviance = results.filter((r) => r.deviance !== null);
  const successful = withDeviance.filter((r) => !r.error);
  const within = withDeviance.filter((r) => r.deviance?.withinTolerance);

  const avgDev =
    successful.length > 0
      ? successful.reduce((sum, r) => sum + (r.deviance?.percentageDifference ?? 0), 0) /
        successful.length
      : 0;

  const maxDev =
    successful.length > 0
      ? Math.max(...successful.map((r) => r.deviance?.percentageDifference ?? 0))
      : 0;

  return {
    totalRecords: results.length,
    successfulComparisons: successful.length,
    failedComparisons: results.filter((r) => r.error).length,
    avgDeviance: avgDev,
    maxDeviance: maxDev,
    withinToleranceCount: within.length,
    toleranceRate: (within.length / withDeviance.length) * 100,
  };
}
