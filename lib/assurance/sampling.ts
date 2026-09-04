// Risk-based sample selection for an assurance engagement.
//
// An assurance provider does not test records at random with equal
// probability. They test the weakest evidence first: proxy and extrapolated
// figures, records above materiality, and anything already flagged. This
// module builds that sample from the organisation's own data provenance
// tiers (lib/inventory/provenance.ts) rather than leaving the selection to
// manual judgement alone.

import { DATA_ORIGIN_META } from "@/lib/inventory/provenance";
import type { DataOrigin } from "@prisma/client";

export interface SampleCandidate {
  id: string;
  activityRecordId: string;
  dataOrigin: DataOrigin;
  totalCo2e: number;
}

export interface SuggestedSampleItem {
  emissionCalculationId: string;
  activityRecordId: string;
  samplingMethod: "full_population" | "risk_based" | "random";
  selectionRationale: string;
  testProcedure: string;
}

export interface SamplingPlanParams {
  candidates: SampleCandidate[];
  /// Records above this tCO2e are tested in full, per common ISAE 3000 practice.
  materialityThresholdCo2e: number;
  /// Target sample size for the risk-based and random strata combined,
  /// excluding whatever the full-population stratum already pulled in.
  targetSampleSize: number;
}

/**
 * Builds a stratified sample: every record above materiality, then the
 * weakest-provenance records up to the target size, then a random top-up if
 * the weak-provenance stratum does not fill it.
 *
 * Each item explains why it was picked, because a sampling approach that
 * cannot be explained is the first thing a quality reviewer challenges.
 */
export function buildSamplingPlan(params: SamplingPlanParams): SuggestedSampleItem[] {
  const { candidates, materialityThresholdCo2e, targetSampleSize } = params;
  const selected = new Map<string, SuggestedSampleItem>();

  // Stratum 1: full population above materiality. Every one of these must be
  // tested regardless of how many that turns out to be.
  for (const c of candidates) {
    if (c.totalCo2e >= materialityThresholdCo2e) {
      selected.set(c.id, {
        emissionCalculationId: c.id,
        activityRecordId: c.activityRecordId,
        samplingMethod: "full_population",
        selectionRationale: `Total of ${c.totalCo2e.toFixed(2)} tCO2e meets or exceeds the ${materialityThresholdCo2e.toFixed(2)} tCO2e materiality threshold, so this record is tested in full rather than sampled.`,
        testProcedure:
          "Trace the reported figure to source evidence (invoice, meter reading, delivery note) and recompute the calculation independently.",
      });
    }
  }

  // Stratum 2: weakest provenance first, ranked by reliability score. This is
  // where a real reviewer spends most of their time, and it is the stratum
  // Phase A's provenance tiers exist to support.
  const remaining = candidates.filter((c) => !selected.has(c.id));
  const byWeakness = [...remaining].sort(
    (a, b) => DATA_ORIGIN_META[b.dataOrigin].reliabilityScore - DATA_ORIGIN_META[a.dataOrigin].reliabilityScore,
  );

  for (const c of byWeakness) {
    if (selected.size >= targetSampleSize) break;
    const tier = DATA_ORIGIN_META[c.dataOrigin];
    if (tier.reliabilityScore < 3) continue; // Reserve this stratum for estimated and below.
    selected.set(c.id, {
      emissionCalculationId: c.id,
      activityRecordId: c.activityRecordId,
      samplingMethod: "risk_based",
      selectionRationale: `Data origin is "${tier.label}" (reliability tier ${tier.reliabilityScore} of 5), among the weakest evidence in the population and therefore prioritised for testing.`,
      testProcedure:
        tier.reliabilityScore >= 4
          ? "Request the underlying justification for the estimate, assess whether it is reasonable, and consider whether better evidence was available and not used."
          : "Review the basis of the estimate against comparable metered or invoiced records for the same activity type.",
    });
  }

  // Stratum 3: random top-up so the sample is not entirely risk-directed,
  // which would let a systematic error in a strong-provenance category go
  // untested.
  if (selected.size < targetSampleSize) {
    const pool = remaining.filter((c) => !selected.has(c.id));
    const shuffled = seededShuffle(pool, targetSampleSize);
    for (const c of shuffled) {
      if (selected.size >= targetSampleSize) break;
      selected.set(c.id, {
        emissionCalculationId: c.id,
        activityRecordId: c.activityRecordId,
        samplingMethod: "random",
        selectionRationale:
          "Selected at random to provide coverage across the population beyond the risk-directed and full-population strata.",
        testProcedure:
          "Trace the reported figure to source evidence and recompute the calculation independently.",
      });
    }
  }

  return Array.from(selected.values());
}

/**
 * Deterministic shuffle so the same candidate pool produces the same random
 * stratum on a retry, which matters when a reviewer asks "why this record and
 * not that one" and the answer needs to be reproducible.
 */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let state = seed || 1;
  const next = () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state |= 0;
    return (Math.abs(state) % 1_000_000) / 1_000_000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Suggested materiality threshold as a share of the total, when the
 * engagement has not set an absolute figure. 5% of total inventory emissions
 * is a common starting point for limited assurance.
 */
export function suggestMaterialityThreshold(
  totalCo2e: number,
  percent = 5,
): number {
  return Math.max(0, totalCo2e) * (percent / 100);
}
