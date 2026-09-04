// Data completeness matrix — facility x emission category x reporting period
// coverage. Which cells are "expected" is a real, admin-configured
// requirement (DataCompletenessRequirement), not a heuristic guess; RAG
// status per cell is computed live from ActivityRecord coverage for that
// facility, category and period. This module holds the pure grading logic;
// the API route does the DB queries.

export type RagStatus = "green" | "amber" | "red" | "not_required";

export interface CompletenessCellInput {
  facilityId: string;
  emissionCategoryId: string;
  required: boolean;
  ownerUserId: string | null;
  /** Total ActivityRecords for this facility + category + period, any status. */
  recordCount: number;
  /** Subset of recordCount with reviewStatus = "approved". */
  approvedCount: number;
}

export interface CompletenessCell extends CompletenessCellInput {
  status: RagStatus;
}

/**
 * green  — at least one approved record exists (data received and reviewed).
 * amber  — a record exists but none are approved yet (received, not reviewed).
 * red    — required, but nothing has been submitted at all.
 * not_required — this facility/category combination isn't expected to report.
 */
export function computeCellStatus(input: {
  required: boolean;
  recordCount: number;
  approvedCount: number;
}): RagStatus {
  if (!input.required) return "not_required";
  if (input.approvedCount > 0) return "green";
  if (input.recordCount > 0) return "amber";
  return "red";
}

export function gradeCells(inputs: CompletenessCellInput[]): CompletenessCell[] {
  return inputs.map((input) => ({ ...input, status: computeCellStatus(input) }));
}

export interface CompletenessSummary {
  totalRequired: number;
  green: number;
  amber: number;
  red: number;
  /** Percentage of required cells that are green (data received and approved). */
  completenessPercent: number;
}

export function summarizeCompleteness(cells: CompletenessCell[]): CompletenessSummary {
  const required = cells.filter((c) => c.status !== "not_required");
  const green = required.filter((c) => c.status === "green").length;
  const amber = required.filter((c) => c.status === "amber").length;
  const red = required.filter((c) => c.status === "red").length;

  return {
    totalRequired: required.length,
    green,
    amber,
    red,
    completenessPercent: required.length > 0 ? (green / required.length) * 100 : 0,
  };
}
