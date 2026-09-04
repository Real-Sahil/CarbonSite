// Keeps a biodiversity assessment's stored totals in agreement with its
// parcels, and turns a habitat parcel's inputs into units plus the arithmetic
// that produced them.
//
// Units are never accepted from the client. A parcel holds only the metric
// inputs; the units and the working are derived here so the register cannot
// contain a figure that disagrees with its own inputs.

import { prisma } from "@/lib/db";
import type { PrismaClient, HabitatParcel, ParcelStage } from "@prisma/client";
import {
  baselineUnits,
  createdUnits,
  assessNetGain,
  timeToTargetMultiplier,
  DISTINCTIVENESS_SCORE,
  CONDITION_SCORE,
  STRATEGIC_SIGNIFICANCE_MULTIPLIER,
  DIFFICULTY_MULTIPLIER,
  SPATIAL_RISK_MULTIPLIER,
  MODULE_UNIT,
  type BiodiversityModule,
  type Distinctiveness,
  type HabitatCondition,
  type StrategicSignificance,
  type Difficulty,
  type SpatialRisk,
} from "./biodiversity-metric";

/** Stages whose units count toward the post-development position. */
const POST_INTERVENTION_STAGES: ReadonlySet<ParcelStage> = new Set<ParcelStage>([
  "retained",
  "enhanced",
  "created",
]);

/**
 * Stages that carry the three risk multipliers. Retained habitat already
 * exists and is not discounted for delivery risk; baseline habitat is what
 * was there to begin with.
 */
const RISK_ADJUSTED_STAGES: ReadonlySet<ParcelStage> = new Set<ParcelStage>([
  "enhanced",
  "created",
]);

export interface ParcelMetricInput {
  stage: ParcelStage;
  module: BiodiversityModule;
  size: number;
  distinctiveness: Distinctiveness;
  condition: HabitatCondition;
  strategicSignificance: StrategicSignificance;
  difficulty: Difficulty;
  yearsToTargetCondition: number;
  spatialRisk: SpatialRisk;
}

export interface ParcelMetricResult {
  units: number;
  /// The arithmetic, written out so a planning officer can check it by hand.
  calculation: string;
}

/**
 * Units for one parcel, plus a written record of how they were arrived at.
 *
 * Baseline and retained parcels are valued on the four base terms alone.
 * Enhanced and created parcels additionally carry difficulty, time to target
 * condition and spatial risk, because their value is a promise rather than a
 * present fact.
 */
export function computeParcelUnits(input: ParcelMetricInput): ParcelMetricResult {
  const size = Math.max(0, input.size);
  const d = DISTINCTIVENESS_SCORE[input.distinctiveness];
  const c = CONDITION_SCORE[input.condition];
  const s = STRATEGIC_SIGNIFICANCE_MULTIPLIER[input.strategicSignificance];
  const unit = MODULE_UNIT[input.module];

  const base = { size, distinctiveness: input.distinctiveness, condition: input.condition, strategicSignificance: input.strategicSignificance };

  if (!RISK_ADJUSTED_STAGES.has(input.stage)) {
    const units = baselineUnits(base);
    return {
      units,
      calculation: `${size} ${unit} x ${d} distinctiveness x ${c} condition x ${s} strategic significance = ${units.toFixed(4)} units`,
    };
  }

  const diff = DIFFICULTY_MULTIPLIER[input.difficulty];
  const time = timeToTargetMultiplier(input.yearsToTargetCondition);
  const spatial = SPATIAL_RISK_MULTIPLIER[input.spatialRisk];

  const units = createdUnits({
    ...base,
    difficulty: input.difficulty,
    yearsToTargetCondition: input.yearsToTargetCondition,
    spatialRisk: input.spatialRisk,
  });

  return {
    units,
    calculation:
      `${size} ${unit} x ${d} distinctiveness x ${c} condition x ${s} strategic significance ` +
      `x ${diff} difficulty x ${time.toFixed(4)} time to target (${input.yearsToTargetCondition} years at 3.5%) ` +
      `x ${spatial} spatial risk = ${units.toFixed(4)} units`,
  };
}

export interface AssessmentTotals {
  area: { baseline: number; postIntervention: number };
  hedgerow: { baseline: number; postIntervention: number };
  watercourse: { baseline: number; postIntervention: number };
}

/** Sums parcel units into the six module totals an assessment carries. */
export function totalsFromParcels(
  parcels: Array<Pick<HabitatParcel, "stage" | "module" | "units">>,
): AssessmentTotals {
  const totals: AssessmentTotals = {
    area: { baseline: 0, postIntervention: 0 },
    hedgerow: { baseline: 0, postIntervention: 0 },
    watercourse: { baseline: 0, postIntervention: 0 },
  };

  for (const parcel of parcels) {
    const module = parcel.module as BiodiversityModule;
    const units = Number(parcel.units);
    if (!Number.isFinite(units)) continue;

    if (parcel.stage === "baseline") {
      totals[module].baseline += units;
    } else if (POST_INTERVENTION_STAGES.has(parcel.stage)) {
      totals[module].postIntervention += units;
    }
  }

  return totals;
}

/**
 * Recomputes an assessment's stored totals and its pass or fail position from
 * its parcels. Called after any parcel is added, changed or removed.
 */
export async function recalculateAssessment(
  organizationId: string,
  assessmentId: string,
  db: PrismaClient = prisma,
) {
  const parcels = await db.habitatParcel.findMany({
    where: { assessmentId, organizationId },
    select: { stage: true, module: true, units: true },
  });

  const totals = totalsFromParcels(parcels);
  const result = assessNetGain(totals);

  return db.biodiversityAssessment.update({
    where: { id: assessmentId },
    data: {
      baselineAreaUnits: totals.area.baseline,
      baselineHedgerowUnits: totals.hedgerow.baseline,
      baselineWatercourseUnits: totals.watercourse.baseline,
      postAreaUnits: totals.area.postIntervention,
      postHedgerowUnits: totals.hedgerow.postIntervention,
      postWatercourseUnits: totals.watercourse.postIntervention,
      meetsRequirement: result.meetsRequirement,
    },
  });
}

/** Reads an assessment's stored totals back into the shape the metric wants. */
export function totalsFromAssessment(assessment: {
  baselineAreaUnits: unknown;
  baselineHedgerowUnits: unknown;
  baselineWatercourseUnits: unknown;
  postAreaUnits: unknown;
  postHedgerowUnits: unknown;
  postWatercourseUnits: unknown;
}): AssessmentTotals {
  return {
    area: {
      baseline: Number(assessment.baselineAreaUnits),
      postIntervention: Number(assessment.postAreaUnits),
    },
    hedgerow: {
      baseline: Number(assessment.baselineHedgerowUnits),
      postIntervention: Number(assessment.postHedgerowUnits),
    },
    watercourse: {
      baseline: Number(assessment.baselineWatercourseUnits),
      postIntervention: Number(assessment.postWatercourseUnits),
    },
  };
}
