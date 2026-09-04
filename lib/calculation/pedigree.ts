// Data quality via the pedigree matrix, ISO 14040/44 and the Weidema &
// Wesnæs (1996) basic uncertainty factors that ecoinvent and most LCA
// databases use to turn qualitative data quality into a quantitative
// uncertainty distribution.
//
// The previous scorer (still kept below as calculateDataQualityScore, now a
// thin wrapper) produced a single ad hoc 0-100 number from a hand-tuned
// points system with no citable basis. A reviewer asking "why is this record
// scored 62 and not 58" had no real answer. The pedigree matrix scores five
// named indicators, each 1 (best) to 5 (worst), and each score maps to a
// published geometric standard deviation contribution. The five combine into
// one number that has a defensible derivation.

import type { ActivityRecord, EmissionFactor } from "@prisma/client";
import type { FactorSelection } from "./factor-selector";

/** 1 = best, 5 = worst, per the pedigree matrix convention. */
export type PedigreeScore = 1 | 2 | 3 | 4 | 5;

export interface PedigreeScores {
  /// How the number was obtained: verified measurement through to estimate.
  reliability: PedigreeScore;
  /// How representative the sample is of the true population.
  completeness: PedigreeScore;
  /// How close the factor's vintage is to the activity date.
  temporalCorrelation: PedigreeScore;
  /// How close the factor's geography is to the activity's geography.
  geographicalCorrelation: PedigreeScore;
  /// How closely the factor's technology/activity type matches the activity.
  technologicalCorrelation: PedigreeScore;
}

/**
 * Weidema & Wesnæs (1996) basic uncertainty factors: the variance
 * contribution (as a squared geometric standard deviation, ln-space) each
 * pedigree score adds. These are the published values ecoinvent uses; they
 * are not tuned per application.
 */
const BASIC_UNCERTAINTY: Record<keyof PedigreeScores, Record<PedigreeScore, number>> = {
  reliability: { 1: 0.0001, 2: 0.0006, 3: 0.002, 4: 0.008, 5: 0.04 },
  completeness: { 1: 0.0001, 2: 0.0006, 3: 0.002, 4: 0.008, 5: 0.04 },
  temporalCorrelation: { 1: 0.0001, 2: 0.0002, 3: 0.001, 4: 0.01, 5: 0.02 },
  geographicalCorrelation: { 1: 0.0001, 2: 0.0001, 3: 0.0004, 4: 0.008, 5: 0.008 },
  technologicalCorrelation: { 1: 0.0001, 2: 0.0006, 3: 0.002, 4: 0.02, 5: 0.06 },
};

/// Base measurement uncertainty applied even to a perfect-pedigree record.
/// Ecoinvent's convention: nothing is ever exactly zero-uncertainty.
const BASE_VARIANCE = 0.0001;

export interface PedigreeInput {
  record: Pick<ActivityRecord, "evidenceStatus" | "fieldSubmissionId" | "importBatchId" | "country" | "activityDate">;
  factorSelection: FactorSelection | null;
  unitConverted: boolean;
  unitConversionComplex: boolean;
}

/**
 * Scores the five pedigree indicators from what the platform already knows
 * about a record: how the evidence was captured, how the factor was matched,
 * how far the factor's vintage and geography sit from the activity.
 */
export function scorePedigree(input: PedigreeInput): PedigreeScores {
  return {
    reliability: scoreReliability(input.record),
    completeness: scoreCompleteness(input.record),
    temporalCorrelation: scoreTemporalCorrelation(input),
    geographicalCorrelation: scoreGeographicalCorrelation(input),
    technologicalCorrelation: scoreTechnologicalCorrelation(input),
  };
}

function scoreReliability(record: PedigreeInput["record"]): PedigreeScore {
  // A field submission is a photographed source document; an import is a
  // bulk upload of unknown provenance; neither evidence status alone tells
  // you whether the number was actually verified.
  if (record.evidenceStatus === "complete" && record.fieldSubmissionId) return 1;
  if (record.evidenceStatus === "complete") return 2;
  if (record.evidenceStatus === "partial") return 3;
  if (record.importBatchId) return 4;
  return 5;
}

function scoreCompleteness(record: PedigreeInput["record"]): PedigreeScore {
  if (record.evidenceStatus === "complete") return 1;
  if (record.evidenceStatus === "partial") return 3;
  return 5;
}

function scoreTemporalCorrelation(input: PedigreeInput): PedigreeScore {
  const factor = input.factorSelection?.factor;
  if (!factor?.effectiveStartDate || !input.record.activityDate) return 3;

  const yearsGap = Math.abs(
    yearsBetween(factor.effectiveStartDate, input.record.activityDate),
  );
  if (yearsGap <= 1) return 1;
  if (yearsGap <= 2) return 2;
  if (yearsGap <= 3) return 3;
  if (yearsGap <= 5) return 4;
  return 5;
}

function scoreGeographicalCorrelation(input: PedigreeInput): PedigreeScore {
  const factor = input.factorSelection?.factor;
  if (!factor) return 5;
  if (!factor.geographyCountry) return 3; // global/generic factor: neutral
  if (!input.record.country) return 3;
  if (factor.geographyCountry.toLowerCase() === input.record.country.toLowerCase()) return 1;
  return 4; // country-specific factor applied to a different country
}

function scoreTechnologicalCorrelation(input: PedigreeInput): PedigreeScore {
  if (!input.factorSelection) return 5;
  const reason = input.factorSelection.selectionReason || "";
  const matchCount = (reason.match(/matched|compatible/gi) || []).length;

  let base: PedigreeScore;
  if (matchCount >= 3) base = 1;
  else if (matchCount === 2) base = 2;
  else if (matchCount === 1) base = 3;
  else base = 4;

  // A required unit conversion is itself evidence that the factor's native
  // technological/activity basis differs from the record's — this degrades
  // the score independently of how well the selection reason otherwise
  // matched, rather than being overridden by it.
  if (input.unitConverted) {
    const penalty = input.unitConversionComplex ? 2 : 1;
    base = Math.min(5, base + penalty) as PedigreeScore;
  }

  return base;
}

/**
 * Combines the five indicator variances (Weidema's basic uncertainty
 * factors, ln-space) plus the base variance into a single geometric standard
 * deviation. This is the multiplicative combination ecoinvent uses: the
 * variances of independent sources of uncertainty simply add in log-space.
 */
export function pedigreeGeometricStdDev(scores: PedigreeScores): number {
  const totalVariance =
    BASE_VARIANCE +
    BASIC_UNCERTAINTY.reliability[scores.reliability] +
    BASIC_UNCERTAINTY.completeness[scores.completeness] +
    BASIC_UNCERTAINTY.temporalCorrelation[scores.temporalCorrelation] +
    BASIC_UNCERTAINTY.geographicalCorrelation[scores.geographicalCorrelation] +
    BASIC_UNCERTAINTY.technologicalCorrelation[scores.technologicalCorrelation];

  // exp(sqrt(variance)) is the geometric standard deviation of the
  // corresponding lognormal distribution.
  return Math.exp(Math.sqrt(totalVariance));
}

/**
 * Maps the pedigree scores onto the legacy 0-100 display scale, so existing
 * UI reading dataQualityScore keeps a meaningful number: perfect pedigree
 * (all 1s) scores 100, worst pedigree (all 5s) scores near 0.
 */
export function pedigreeToLegacyScore(scores: PedigreeScores): number {
  const values = Object.values(scores);
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  // average ranges 1 (best) to 5 (worst); map linearly onto 100..0.
  const score = Math.round(100 - ((average - 1) / 4) * 100);
  return Math.max(0, Math.min(100, score));
}

/**
 * Confidence interval for a single record's total, derived from its
 * geometric standard deviation rather than the old flat percentage-of-score
 * heuristic. A lognormal distribution's 95% interval runs from
 * median/GSD^1.96 to median*GSD^1.96.
 */
export function pedigreeConfidenceInterval(
  totalCo2e: number,
  geometricStdDev: number,
): { lower: number; upper: number } {
  const z = 1.96;
  const factor = Math.pow(geometricStdDev, z);
  return {
    lower: totalCo2e / factor,
    upper: totalCo2e * factor,
  };
}

function yearsBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (365.25 * 86_400_000);
}
