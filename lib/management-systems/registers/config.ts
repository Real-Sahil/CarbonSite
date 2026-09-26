// The registers every framework draws on, described once and used by the API
// (validation) and the page (table and form). No Prisma here, so client
// components can import it.

export type FieldType = "text" | "textarea" | "select" | "date" | "score" | "member" | "frameworks" | "boolean" | "audit";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  options?: ReadonlyArray<readonly [string, string]>;
  required?: boolean;
  help?: string;
};

export type RegisterKey = "risks" | "interested-parties" | "policies" | "audits" | "audit-findings" | "corrective-actions" | "management-reviews";

export type RegisterConfig = {
  key: RegisterKey;
  label: string;
  singular: string;
  /** The requirement it answers, shown under the heading. */
  intro: string;
  /** Field shown as the row's title. */
  titleField: string;
  /** Fields shown as table columns after the title. */
  columns: string[];
  fields: Field[];
  /** Evidence kind when a requirement links to one of these rows. */
  evidenceKind: string;
};

const SCORE_HELP = "1 (lowest) to 5 (highest)";

export const REGISTERS: Record<RegisterKey, RegisterConfig> = {
  risks: {
    key: "risks",
    label: "Risks and opportunities",
    singular: "risk or opportunity",
    intro: "Risks and opportunities for every framework in one register (ISO clause 6.1, information security and AI risk assessment). Rating is likelihood times impact.",
    titleField: "title",
    columns: ["kind", "rating", "residualRating", "status", "ownerUserId", "reviewOn"],
    evidenceKind: "ms_risk",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "kind", label: "Type", type: "select", options: [["risk", "Risk"], ["opportunity", "Opportunity"]] },
      { name: "description", label: "Description", type: "textarea" },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
      { name: "likelihood", label: "Likelihood", type: "score", help: SCORE_HELP },
      { name: "impact", label: "Impact", type: "score", help: SCORE_HELP },
      { name: "treatment", label: "Treatment", type: "select", options: [["mitigate", "Mitigate"], ["accept", "Accept"], ["transfer", "Transfer"], ["avoid", "Avoid"], ["exploit", "Exploit (opportunity)"]] },
      { name: "controls", label: "Controls and actions", type: "textarea" },
      { name: "residualLikelihood", label: "Residual likelihood", type: "score", help: SCORE_HELP },
      { name: "residualImpact", label: "Residual impact", type: "score", help: SCORE_HELP },
      { name: "status", label: "Status", type: "select", options: [["open", "Open"], ["treated", "Treated"], ["accepted", "Accepted"], ["closed", "Closed"]] },
      { name: "ownerUserId", label: "Owner", type: "member" },
      { name: "reviewOn", label: "Next review", type: "date" },
    ],
  },
  "interested-parties": {
    key: "interested-parties",
    label: "Interested parties",
    singular: "interested party",
    intro: "Who has a stake in your management systems and which of their requirements you commit to meet (ISO clause 4.2).",
    titleField: "name",
    columns: ["category", "becomesObligation", "frameworks"],
    evidenceKind: "ms_interested_party",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "category", label: "Category", type: "select", options: [["client", "Client"], ["regulator", "Regulator"], ["worker", "Workers"], ["neighbour", "Neighbours and community"], ["supplier", "Suppliers"], ["investor", "Investors and lenders"], ["other", "Other"]] },
      { name: "needs", label: "Needs and expectations", type: "textarea" },
      { name: "becomesObligation", label: "Adopted as a compliance obligation", type: "boolean" },
      { name: "howMonitored", label: "How you monitor them", type: "textarea" },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
    ],
  },
  policies: {
    key: "policies",
    label: "Policies",
    singular: "policy",
    intro: "Policies with their version and approval (ISO clause 5.2, ISO 27001 A.5.1). Editing an approved policy starts a new draft version that needs approving again.",
    titleField: "title",
    columns: ["version", "status", "approvedOn", "reviewOn", "ownerUserId"],
    evidenceKind: "ms_policy",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "category", label: "Category", type: "text" },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
      { name: "body", label: "Policy text", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: [["draft", "Draft"], ["approved", "Approved"], ["retired", "Retired"]] },
      { name: "ownerUserId", label: "Owner", type: "member" },
      { name: "reviewOn", label: "Next review", type: "date" },
    ],
  },
  audits: {
    key: "audits",
    label: "Internal audits",
    singular: "internal audit",
    intro: "The internal audit programme across your frameworks (ISO clause 9.2). Record findings against each audit.",
    titleField: "title",
    columns: ["status", "plannedOn", "completedOn", "leadAuditorUserId", "frameworks"],
    evidenceKind: "ms_audit",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
      { name: "scope", label: "Scope and criteria", type: "textarea" },
      { name: "plannedOn", label: "Planned for", type: "date" },
      { name: "completedOn", label: "Completed on", type: "date" },
      { name: "leadAuditorUserId", label: "Lead auditor", type: "member" },
      { name: "status", label: "Status", type: "select", options: [["planned", "Planned"], ["in_progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]] },
      { name: "summary", label: "Summary and conclusion", type: "textarea" },
    ],
  },
  "audit-findings": {
    key: "audit-findings",
    label: "Audit findings",
    singular: "audit finding",
    intro: "Nonconformities, observations and opportunities for improvement raised in internal audits. Raise a corrective action for each nonconformity.",
    titleField: "description",
    columns: ["auditId", "type", "reference", "status"],
    evidenceKind: "ms_audit_finding",
    fields: [
      { name: "auditId", label: "Audit", type: "audit", required: true },
      { name: "type", label: "Type", type: "select", options: [["major_nonconformity", "Major nonconformity"], ["minor_nonconformity", "Minor nonconformity"], ["observation", "Observation"], ["opportunity", "Opportunity for improvement"]] },
      { name: "reference", label: "Clause or control", type: "text", help: "e.g. ISO 14001 9.1.2" },
      { name: "description", label: "Finding", type: "textarea", required: true },
      { name: "status", label: "Status", type: "select", options: [["open", "Open"], ["closed", "Closed"]] },
    ],
  },
  "corrective-actions": {
    key: "corrective-actions",
    label: "Corrective actions",
    singular: "corrective action",
    intro: "Nonconformities and their corrective actions from any source (ISO clause 10.2). Closing one needs a note on whether it worked.",
    titleField: "title",
    columns: ["source", "status", "ownerUserId", "dueOn", "verifiedOn"],
    evidenceKind: "ms_corrective_action",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "source", label: "Source", type: "select", options: [["audit_finding", "Audit finding"], ["incident", "Incident"], ["complaint", "Complaint"], ["management_review", "Management review"], ["risk", "Risk assessment"], ["other", "Other"]] },
      { name: "sourceReference", label: "Source reference", type: "text" },
      { name: "description", label: "Nonconformity", type: "textarea" },
      { name: "rootCause", label: "Root cause", type: "textarea" },
      { name: "action", label: "Action taken", type: "textarea" },
      { name: "ownerUserId", label: "Owner", type: "member" },
      { name: "dueOn", label: "Due", type: "date" },
      { name: "status", label: "Status", type: "select", options: [["open", "Open"], ["in_progress", "In progress"], ["awaiting_verification", "Awaiting verification"], ["closed", "Closed"]] },
      { name: "verifiedByUserId", label: "Verified by", type: "member" },
      { name: "verifiedOn", label: "Verified on", type: "date" },
      { name: "effectiveness", label: "Did it work?", type: "textarea", help: "Required to close" },
    ],
  },
  "management-reviews": {
    key: "management-reviews",
    label: "Management reviews",
    singular: "management review",
    intro: "Top management reviews of your management systems (ISO clause 9.3): inputs considered, decisions and actions.",
    titleField: "title",
    columns: ["status", "heldOn", "frameworks"],
    evidenceKind: "ms_management_review",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "heldOn", label: "Held on", type: "date" },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
      { name: "attendees", label: "Attendees", type: "textarea" },
      { name: "inputs", label: "Inputs considered", type: "textarea", help: "Status of actions, changes in issues, performance, audit results, risks, resources, opportunities" },
      { name: "decisions", label: "Decisions", type: "textarea" },
      { name: "actions", label: "Actions", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: [["planned", "Planned"], ["held", "Held"]] },
    ],
  },
};

export const REGISTER_KEYS = Object.keys(REGISTERS) as RegisterKey[];

export function isRegisterKey(key: string): key is RegisterKey {
  return key in REGISTERS;
}
