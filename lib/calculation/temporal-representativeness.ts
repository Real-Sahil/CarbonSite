// Temporal representativeness: how stale an emission factor's vintage is
// relative to the activity it's being applied to. ISO 14064-1 §9.3.3 and the
// GHG Protocol both call for temporal correlation to be assessed and, when
// poor, disclosed. The pedigree matrix (see pedigree.ts) already scores this
// as one of its five indicators; this module turns the same gap into a
// standalone, human-readable warning that gets attached to the calculation
// the way any other data-quality warning does.

export interface TemporalRepresentativenessInput {
  factorEffectiveStartDate: Date | null;
  factorEffectiveEndDate: Date | null;
  activityDate: Date;
}

export interface TemporalRepresentativenessResult {
  yearsGap: number | null;
  isStale: boolean;
  warning: string | null;
}

/// Beyond this gap, the factor's technology/grid-mix/regulatory basis is
/// old enough that it should be flagged for reviewer attention. Matches the
/// boundary pedigree.ts uses between temporalCorrelation scores 3 and 4.
const STALE_THRESHOLD_YEARS = 3;

export function assessTemporalRepresentativeness(
  input: TemporalRepresentativenessInput,
): TemporalRepresentativenessResult {
  if (!input.factorEffectiveStartDate) {
    return { yearsGap: null, isStale: false, warning: null };
  }

  // Prefer the end of the factor's validity window (its most recent
  // applicable date) when set; otherwise fall back to when it took effect.
  const vintage = input.factorEffectiveEndDate ?? input.factorEffectiveStartDate;
  const yearsGap = Math.abs(
    (input.activityDate.getTime() - vintage.getTime()) / (365.25 * 86_400_000),
  );

  if (yearsGap <= STALE_THRESHOLD_YEARS) {
    return { yearsGap, isStale: false, warning: null };
  }

  return {
    yearsGap,
    isStale: true,
    warning:
      `Emission factor vintage is ${yearsGap.toFixed(1)} years from the activity date ` +
      `(flagged beyond ${STALE_THRESHOLD_YEARS} years) — the underlying technology, grid ` +
      `mix or methodology may no longer match current conditions.`,
  };
}
