// The sentence the dashboard's "Recent decisions" widget shows for an audit
// action (pure). Only actions written by writeAuditLog() reach here, and each
// sentence states what the audit row records, nothing more. An action with no
// sentence shows its own name, so a new action is never hidden or invented.

const SENTENCES = new Map<string, string>([
  ["snapshot.published", "Published a snapshot"],
  ["record.created", "Added an activity record"],
  ["record.updated", "Changed an activity record"],
  ["record.deleted", "Deleted an activity record"],
  ["record.reviewed", "Reviewed activity records"],
  ["record.sealed", "Sealed an activity record with its evidence"],
  ["field_submission.reviewed", "Reviewed a field submission"],
  ["import.created", "Started an import"],
  ["calculation.run_triggered", "Started a calculation run"],
  ["org.member.added", "Added a member"],
  ["report.downloaded", "Downloaded a report"],
  ["waste_plan.approved", "Approved a site waste plan"],
  ["base_year.recalculation_assessed", "Assessed a base year recalculation"],
]);

/** Every action with a written sentence, for the test that checks each one is really written. */
export const DECISION_ACTIONS: readonly string[] = [...SENTENCES.keys()];

/** The sentence for an audit action, or its own name with underscores as spaces. */
export function decisionSentence(action: string): string {
  return SENTENCES.get(action) ?? action.replaceAll("_", " ");
}
