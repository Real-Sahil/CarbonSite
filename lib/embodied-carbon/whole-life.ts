// Whole-life carbon assembly — EN 15978:2011 modules A-D, following the RICS
// Professional Statement "Whole life carbon assessment for the built
// environment" (2nd ed., 2023).
//
// A1-A5 and D come straight from EmbodiedCarbonRecord.totalKgCo2e, already
// computed and stored per material by lib/embodied-carbon/engine.ts — this
// module doesn't recompute them, only sums what's already there.
//
// B4 (replacement) is the one "use stage" module this platform can compute
// without extra data collection: given a material's replacement cycle and
// the project's assessment period, the number of replacements over the
// study period is deterministic, and each replacement re-incurs that
// material's A1-A3 (+A4+A5 if tracked) impact.
//
// B1 (use), B2 (maintenance) and B3 (repair) have no carbon impact of their
// own in the simplified case, or require facilities-management maintenance
// records this platform doesn't yet capture — they are reported as zero
// with an explicit warning, never a fabricated percentage.
//
// B6 (operational energy) is not modelled here at all — it is the
// project's own real Scope 1+2 emissions over the operational period,
// computed from live EmissionCalculation data by the caller (see the
// whole-life-carbon API route) and passed in, because this module has no
// database access.
//
// B7 (operational water) has no automated data source (no water emission
// category exists yet) and is passed through as a manually entered figure.

export interface WholeLifeMaterialInput {
  /** A1-A5 total for one material record, kgCO2e (from EmbodiedCarbonRecord). */
  embodiedTotalKgCo2e: number;
  /** End-of-life total for the same record (C1-C4, lumped or granular), kgCO2e. */
  endOfLifeKgCo2e: number;
  /** Module D (benefits beyond the system boundary) for the record, kgCO2e — reported separately, never summed into the headline total. */
  moduleDKgCo2e: number;
  /** Years between replacements over the study period. Null = not replaced (assumed to last the whole study period). */
  replacementCycleYears: number | null;
}

export interface WholeLifeCarbonInput {
  materials: WholeLifeMaterialInput[];
  assessmentPeriodYears: number;
  /** Real, measured Scope 1+2 emissions for the project's operational sites over the assessment period, kgCO2e. */
  operationalEnergyKgCo2e: number;
  /** Manually entered — kgCO2e, optional. */
  operationalWaterKgCo2e?: number | null;
}

export interface WholeLifeCarbonResult {
  aStagesKgCo2e: number;
  b4ReplacementKgCo2e: number;
  b6OperationalEnergyKgCo2e: number;
  b7OperationalWaterKgCo2e: number;
  cStagesKgCo2e: number;
  /** Module D, reported as a memo item per EN 15978 convention — never included in wholeLifeTotalKgCo2e. */
  moduleDMemoKgCo2e: number;
  wholeLifeTotalKgCo2e: number;
  warnings: string[];
}

/**
 * Number of times a material is replaced over a study period, per the RICS
 * convention: a replacement due exactly at the end of the study period is
 * not counted (the building's life ends there, so it's never actually
 * reinstalled).
 */
export function replacementCount(assessmentPeriodYears: number, replacementCycleYears: number): number {
  if (replacementCycleYears <= 0) return 0;
  return Math.max(0, Math.ceil(assessmentPeriodYears / replacementCycleYears) - 1);
}

export function computeWholeLifeCarbon(input: WholeLifeCarbonInput): WholeLifeCarbonResult {
  const warnings: string[] = [
    "B1 (use), B2 (maintenance) and B3 (repair) are not modelled — they require facilities " +
      "management maintenance/repair records this platform does not yet capture. Reported as zero " +
      "rather than an assumed percentage.",
  ];

  const aStagesKgCo2e = input.materials.reduce((sum, m) => sum + m.embodiedTotalKgCo2e, 0);
  const cStagesKgCo2e = input.materials.reduce((sum, m) => sum + m.endOfLifeKgCo2e, 0);
  const moduleDMemoKgCo2e = input.materials.reduce((sum, m) => sum + m.moduleDKgCo2e, 0);

  const b4ReplacementKgCo2e = input.materials.reduce((sum, m) => {
    if (m.replacementCycleYears == null) return sum;
    const count = replacementCount(input.assessmentPeriodYears, m.replacementCycleYears);
    return sum + count * m.embodiedTotalKgCo2e;
  }, 0);

  const b6OperationalEnergyKgCo2e = input.operationalEnergyKgCo2e;

  let b7OperationalWaterKgCo2e = 0;
  if (input.operationalWaterKgCo2e != null) {
    b7OperationalWaterKgCo2e = input.operationalWaterKgCo2e;
  } else {
    warnings.push(
      "B7 (operational water) has no automated data source and was not entered manually — reported as zero.",
    );
  }

  const wholeLifeTotalKgCo2e =
    aStagesKgCo2e + b4ReplacementKgCo2e + b6OperationalEnergyKgCo2e + b7OperationalWaterKgCo2e + cStagesKgCo2e;

  return {
    aStagesKgCo2e,
    b4ReplacementKgCo2e,
    b6OperationalEnergyKgCo2e,
    b7OperationalWaterKgCo2e,
    cStagesKgCo2e,
    moduleDMemoKgCo2e,
    wholeLifeTotalKgCo2e,
    warnings,
  };
}
