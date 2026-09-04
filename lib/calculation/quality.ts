// Data quality scoring for uncertainty quantification.
// Score ranges 0-100; higher = more trustworthy calculation.
//
// This used to be an ad hoc points system (evidence 0-30, source 0-20,
// factor match 0-25, unit conversion penalty) with no citable basis — a
// reviewer asking "why is this record scored 62 and not 58" had no real
// answer. It is now a thin wrapper over the ISO 14040/44 pedigree matrix in
// pedigree.ts: five named indicators, each backed by a published Weidema &
// Wesnaes (1996) basic uncertainty factor, combining into one geometric
// standard deviation with a real statistical meaning. The 0-100 scale is
// kept only so existing consumers (dashboards, the high-uncertainty
// supplier-request trigger) that read dataQualityScore keep working.

import type { ActivityRecord } from "@prisma/client";
import type { FactorSelection } from "./factor-selector";
import {
  scorePedigree,
  pedigreeGeometricStdDev,
  pedigreeToLegacyScore,
  pedigreeConfidenceInterval,
  type PedigreeScores,
} from "./pedigree";

export interface QualityInput {
  record: ActivityRecord & { emissionCategory: { scope: number } };
  factorSelection: FactorSelection | null;
  unitConverted: boolean;
  unitConversionComplex: boolean;
}

export function calculateDataQualityScore(input: QualityInput): {
  score: number;
  breakdown: Record<string, number>;
  pedigreeScores: PedigreeScores;
  geometricStdDev: number;
} {
  const pedigreeScores = scorePedigree({
    record: input.record,
    factorSelection: input.factorSelection,
    unitConverted: input.unitConverted,
    unitConversionComplex: input.unitConversionComplex,
  });
  const geometricStdDev = pedigreeGeometricStdDev(pedigreeScores);
  const score = pedigreeToLegacyScore(pedigreeScores);

  return {
    score,
    breakdown: {
      reliability: pedigreeScores.reliability,
      completeness: pedigreeScores.completeness,
      temporalCorrelation: pedigreeScores.temporalCorrelation,
      geographicalCorrelation: pedigreeScores.geographicalCorrelation,
      technologicalCorrelation: pedigreeScores.technologicalCorrelation,
    },
    pedigreeScores,
    geometricStdDev,
  };
}

/**
 * Confidence interval for a single record's total, derived from its
 * pedigree-implied geometric standard deviation (a lognormal distribution)
 * rather than the old flat percentage-of-score heuristic. Callers pass the
 * geometricStdDev from calculateDataQualityScore() above as the second
 * argument.
 */
export function calculateConfidenceInterval(
  totalCo2e: number,
  geometricStdDev: number,
): {
  lower: number;
  upper: number;
  percentMargin: number;
} {
  const { lower, upper } = pedigreeConfidenceInterval(totalCo2e, geometricStdDev);
  const percentMargin =
    totalCo2e !== 0 ? ((upper - lower) / 2 / Math.abs(totalCo2e)) * 100 : 0;
  return { lower, upper, percentMargin };
}
