// ISO 14001 clause 6.1.2 aspects and impacts register.
//
// An activity has an environmental aspect, which causes an impact. Each is
// scored and the significant ones must be met with an objective, a target or
// an operational control. The scoring model here is the common severity x
// likelihood x legal product, which keeps the arithmetic auditable.

import type { AspectSignificance } from "@prisma/client";

/** Each input is scored 1 to 5. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export interface AspectScores {
  severityScore: number;
  likelihoodScore: number;
  legalScore: number;
}

export function clampScore(n: number): number {
  // NaN carries no ordering information, so it floors rather than clamping.
  // An infinity does have a direction and clamps to that end of the band.
  if (Number.isNaN(n)) return SCORE_MIN;
  if (n < SCORE_MIN) return SCORE_MIN;
  if (n > SCORE_MAX) return SCORE_MAX;
  return Math.round(n);
}

/** Product of the three inputs, ranging 1 to 125. */
export function significanceScore(scores: AspectScores): number {
  return (
    clampScore(scores.severityScore) *
    clampScore(scores.likelihoodScore) *
    clampScore(scores.legalScore)
  );
}

/**
 * Banding of the score into the four significance ratings.
 *
 * The legal score overrides the band: an aspect with the highest legal
 * exposure is significant whatever its likelihood, because a breach of a
 * statutory limit is significant by definition even if it is rare.
 */
export function rateSignificance(scores: AspectScores): AspectSignificance {
  const legal = clampScore(scores.legalScore);
  if (legal === SCORE_MAX) return "significant";

  const score = significanceScore(scores);
  if (score >= 60) return "significant";
  if (score >= 30) return "high";
  if (score >= 12) return "medium";
  return "low";
}

/** Whether ISO 14001 requires a documented control or objective for this rating. */
export function requiresControl(significance: AspectSignificance): boolean {
  return significance === "significant" || significance === "high";
}

export interface AspectRegisterSummary {
  total: number;
  bySignificance: Record<AspectSignificance, number>;
  /// Significant or high aspects with nothing recorded under controls or
  /// further action. These are the audit findings waiting to happen.
  uncontrolledSignificant: number;
  overdueReviews: number;
}

export function summariseAspectRegister(
  aspects: Array<{
    significance: AspectSignificance;
    existingControls: string | null;
    furtherAction: string | null;
    nextReviewOn: Date | null;
  }>,
  now: Date = new Date(),
): AspectRegisterSummary {
  const summary: AspectRegisterSummary = {
    total: aspects.length,
    bySignificance: { low: 0, medium: 0, high: 0, significant: 0 },
    uncontrolledSignificant: 0,
    overdueReviews: 0,
  };

  for (const aspect of aspects) {
    summary.bySignificance[aspect.significance] += 1;

    if (requiresControl(aspect.significance)) {
      const hasControl = (aspect.existingControls?.trim().length ?? 0) > 0;
      const hasAction = (aspect.furtherAction?.trim().length ?? 0) > 0;
      if (!hasControl && !hasAction) summary.uncontrolledSignificant += 1;
    }

    if (aspect.nextReviewOn && aspect.nextReviewOn.getTime() < now.getTime()) {
      summary.overdueReviews += 1;
    }
  }

  return summary;
}
