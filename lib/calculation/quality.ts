// Data quality scoring for uncertainty quantification.
// Score ranges 0-100; higher = more trustworthy calculation.
// Used to compute confidence intervals and flag high-uncertainty records.

import type { ActivityRecord, EmissionFactor } from "@prisma/client";
import type { FactorSelection } from "./factor-selector";

export interface QualityInput {
  record: ActivityRecord & { emissionCategory: { scope: number } };
  factorSelection: FactorSelection | null;
  unitConverted: boolean;
  unitConversionComplex: boolean;
}

export function calculateDataQualityScore(input: QualityInput): {
  score: number;
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {};
  let score = 0;

  // Evidence status contribution (0-30 points)
  switch (input.record.evidenceStatus) {
    case "complete":
      breakdown.evidence = 30;
      score += 30;
      break;
    case "partial":
      breakdown.evidence = 15;
      score += 15;
      break;
    case "missing":
      breakdown.evidence = 5;
      score += 5;
      break;
  }

  // Source quality (0-20 points)
  if (input.record.fieldSubmissionId) {
    breakdown.source = 20;
    score += 20;
  } else if (input.record.importBatchId) {
    breakdown.source = 10;
    score += 10;
  } else {
    breakdown.source = 5;
    score += 5;
  }

  // Factor match quality (0-25 points)
  if (input.factorSelection) {
    const reason = input.factorSelection.selectionReason || "";
    const matchCount = (reason.match(/matched|compatible/gi) || []).length;
    if (matchCount >= 3) {
      breakdown.factorMatch = 25;
      score += 25;
    } else if (matchCount === 2) {
      breakdown.factorMatch = 15;
      score += 15;
    } else if (matchCount === 1) {
      breakdown.factorMatch = 8;
      score += 8;
    } else {
      breakdown.factorMatch = 3;
      score += 3;
    }
  } else {
    breakdown.factorMatch = -30;
    score -= 30;
  }

  // Unit conversion penalty (0 to -15 points)
  if (input.unitConverted) {
    if (input.unitConversionComplex) {
      breakdown.unitConversion = -15;
      score -= 15;
    } else {
      breakdown.unitConversion = -7;
      score -= 7;
    }
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, breakdown };
}

// Confidence interval calculation based on quality score and total CO2e value.
// Higher quality = tighter interval.
export function calculateConfidenceInterval(
  totalCo2e: number,
  dataQualityScore: number,
): {
  lower: number;
  upper: number;
  percentMargin: number;
} {
  // Margin of error (as percentage) inversely correlated with quality score
  // Score 100 = ±2% margin, Score 50 = ±25% margin, Score 0 = ±50% margin
  const percentMargin = ((100 - dataQualityScore) / 2) + 2;

  const margin = (totalCo2e * percentMargin) / 100;
  const lower = Math.max(0, totalCo2e - margin);
  const upper = totalCo2e + margin;

  return { lower, upper, percentMargin };
}
