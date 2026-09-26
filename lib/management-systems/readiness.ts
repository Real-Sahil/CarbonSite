import { assessableRequirements, type CatalogueFramework } from "./catalogue";

export const REQUIREMENT_STATES = ["not_started", "in_progress", "implemented", "not_applicable"] as const;
export type RequirementState = (typeof REQUIREMENT_STATES)[number];

export type Readiness = {
  /** Requirements the organisation assesses (headings excluded). */
  total: number;
  notApplicable: number;
  implemented: number;
  inProgress: number;
  notStarted: number;
  /** Implemented share of the applicable requirements, 0-100, or null when none apply. */
  percent: number | null;
  /** Implemented requirements with no evidence linked. */
  implementedWithoutEvidence: number;
};

/**
 * How far an organisation is through a framework. A requirement nobody has
 * touched counts as not started; "not applicable" leaves the denominator, so
 * excluding a clause never raises the score by itself being counted done.
 */
export function readiness(
  framework: CatalogueFramework,
  statuses: Map<string, RequirementState>,
  evidenceCounts: Map<string, number> = new Map(),
): Readiness {
  const r: Readiness = { total: 0, notApplicable: 0, implemented: 0, inProgress: 0, notStarted: 0, percent: null, implementedWithoutEvidence: 0 };
  for (const req of assessableRequirements(framework)) {
    r.total++;
    const state = statuses.get(req.code) ?? "not_started";
    if (state === "not_applicable") r.notApplicable++;
    else if (state === "implemented") {
      r.implemented++;
      if (!evidenceCounts.get(req.code)) r.implementedWithoutEvidence++;
    } else if (state === "in_progress") r.inProgress++;
    else r.notStarted++;
  }
  const applicable = r.total - r.notApplicable;
  r.percent = applicable > 0 ? Math.round((r.implemented / applicable) * 100) : null;
  return r;
}
