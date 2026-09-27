// The registers every framework draws on, described once and used by the API
// (validation) and the page (table and form). No Prisma here, so client
// components can import it.

export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "date"
  | "score"
  | "number"
  | "member"
  /** Any member of the organisation, field workers included (training records). */
  | "person"
  | "frameworks"
  | "boolean"
  /** A row of another register, named by `ref`. */
  | "row"
  /** One of the organisation's evidence files (upload or pick). */
  | "file"
  /** Inspection results against the chosen template's checklist. */
  | "checklist";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  options?: ReadonlyArray<readonly [string, string]>;
  required?: boolean;
  help?: string;
  /** For "row" fields: the register the row belongs to. */
  ref?: RegisterKey;
};

export type RegisterKey =
  | "risks"
  | "interested-parties"
  | "policies"
  | "documents"
  | "changes"
  | "objectives"
  | "competences"
  | "training-records"
  | "audits"
  | "audit-findings"
  | "inspection-templates"
  | "inspections"
  | "corrective-actions"
  | "complaints"
  | "nonconformities"
  | "supplier-evaluations"
  | "equipment"
  | "management-reviews";

/** Groups on the overview, in order. */
export const REGISTER_GROUPS: Array<{ label: string; keys: RegisterKey[] }> = [
  { label: "Plan", keys: ["risks", "interested-parties", "objectives", "changes"] },
  { label: "Support", keys: ["policies", "documents", "competences", "training-records", "equipment"] },
  { label: "Operate", keys: ["supplier-evaluations", "inspection-templates", "inspections"] },
  { label: "Check and improve", keys: ["audits", "audit-findings", "complaints", "nonconformities", "corrective-actions", "management-reviews"] },
];

/** Dates that trigger reminders to the row's owner (or the management system editors when it has none). */
export type Reminder = { field: string; label: string; ownerField?: string; skipStatuses?: string[] };

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
  /** Dates the daily reminder monitor watches. */
  reminders?: Reminder[];
  /** Policies and documents: members can confirm they have read the current approved version. */
  acknowledgeable?: boolean;
};

const SCORE_HELP = "1 (lowest) to 5 (highest)";
const CLOSED = ["closed", "retired", "withdrawn", "cancelled", "completed", "achieved", "implemented", "rejected", "suspended"];

export const REGISTERS: Record<RegisterKey, RegisterConfig> = {
  risks: {
    key: "risks",
    label: "Risks and opportunities",
    singular: "risk or opportunity",
    intro: "Risks and opportunities for every framework in one register (ISO clause 6.1, information security and AI risk assessment). Rating is likelihood times impact.",
    titleField: "title",
    columns: ["kind", "rating", "residualRating", "status", "ownerUserId", "reviewOn"],
    evidenceKind: "ms_risk",
    reminders: [{ field: "reviewOn", label: "Risk review", ownerField: "ownerUserId", skipStatuses: CLOSED }],
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
    acknowledgeable: true,
    reminders: [{ field: "reviewOn", label: "Policy review", ownerField: "ownerUserId", skipStatuses: CLOSED }],
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
    reminders: [{ field: "plannedOn", label: "Internal audit", ownerField: "leadAuditorUserId", skipStatuses: CLOSED }],
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
      { name: "auditId", label: "Audit", type: "row", ref: "audits", required: true },
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
    reminders: [{ field: "dueOn", label: "Corrective action", ownerField: "ownerUserId", skipStatuses: CLOSED }],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "source", label: "Source", type: "select", options: [["audit_finding", "Audit finding"], ["incident", "Incident"], ["complaint", "Complaint"], ["inspection", "Inspection"], ["nonconformity", "Nonconforming output"], ["management_review", "Management review"], ["risk", "Risk assessment"], ["other", "Other"]] },
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
  documents: {
    key: "documents",
    label: "Controlled documents",
    singular: "document",
    intro: "Procedures, work instructions, forms and plans under document control (ISO clause 7.5): owner, version, approval and review date. Editing an approved document's title, text or file starts a new draft version; the old version stays in the audit log. Tick 'Must be read' to ask members to confirm they have read it.",
    titleField: "title",
    columns: ["reference", "docType", "version", "status", "reviewOn", "ownerUserId"],
    evidenceKind: "ms_document",
    acknowledgeable: true,
    reminders: [{ field: "reviewOn", label: "Document review", ownerField: "ownerUserId", skipStatuses: CLOSED }],
    fields: [
      { name: "reference", label: "Reference", type: "text", help: "e.g. EMS-PR-03" },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "docType", label: "Type", type: "select", options: [["procedure", "Procedure"], ["work_instruction", "Work instruction"], ["form", "Form or template"], ["plan", "Plan"], ["manual", "Manual"], ["register", "Register"], ["external", "External document"]] },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
      { name: "body", label: "Summary or text", type: "textarea" },
      { name: "fileId", label: "File", type: "file" },
      { name: "changeNote", label: "What changed in this version", type: "text" },
      { name: "status", label: "Status", type: "select", options: [["draft", "Draft"], ["approved", "Approved"], ["withdrawn", "Withdrawn"]] },
      { name: "ownerUserId", label: "Owner", type: "member" },
      { name: "reviewOn", label: "Next review", type: "date" },
      { name: "requiresAcknowledgement", label: "Must be read by members", type: "boolean" },
    ],
  },
  changes: {
    key: "changes",
    label: "Planned changes",
    singular: "planned change",
    intro: "Changes to your management systems planned before they happen (ISO clause 6.3, new in ISO 14001:2026): why, what could go wrong, resources and who is responsible.",
    titleField: "title",
    columns: ["status", "plannedOn", "ownerUserId", "frameworks"],
    evidenceKind: "ms_change",
    reminders: [{ field: "plannedOn", label: "Planned change", ownerField: "ownerUserId", skipStatuses: CLOSED }],
    fields: [
      { name: "title", label: "Change", type: "text", required: true },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
      { name: "reason", label: "Purpose and reason", type: "textarea" },
      { name: "consequences", label: "Possible consequences and how they are controlled", type: "textarea" },
      { name: "resources", label: "Resources and responsibilities", type: "textarea" },
      { name: "ownerUserId", label: "Owner", type: "member" },
      { name: "plannedOn", label: "Planned for", type: "date" },
      { name: "status", label: "Status", type: "select", options: [["proposed", "Proposed"], ["approved", "Approved"], ["implemented", "Implemented"], ["rejected", "Rejected"]] },
    ],
  },
  objectives: {
    key: "objectives",
    label: "Objectives",
    singular: "objective",
    intro: "Measurable objectives for each framework (ISO clause 6.2): measure, baseline, target and date, the plan to achieve them and progress so far.",
    titleField: "title",
    columns: ["measure", "current", "target", "targetDate", "status", "ownerUserId"],
    evidenceKind: "ms_objective",
    reminders: [
      { field: "reviewOn", label: "Objective progress review", ownerField: "ownerUserId", skipStatuses: CLOSED },
      { field: "targetDate", label: "Objective target date", ownerField: "ownerUserId", skipStatuses: CLOSED },
    ],
    fields: [
      { name: "title", label: "Objective", type: "text", required: true },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
      { name: "measure", label: "Measure", type: "text", help: "e.g. Accident frequency rate, waste diverted from landfill" },
      { name: "unit", label: "Unit", type: "text", help: "e.g. %, per 100,000 hours, tCO2e" },
      { name: "baseline", label: "Baseline", type: "number" },
      { name: "target", label: "Target", type: "number" },
      { name: "current", label: "Latest value", type: "number" },
      { name: "targetDate", label: "Target date", type: "date" },
      { name: "plan", label: "Actions, resources and how results are evaluated", type: "textarea" },
      { name: "ownerUserId", label: "Owner", type: "member" },
      { name: "status", label: "Status", type: "select", options: [["on_track", "On track"], ["at_risk", "At risk"], ["off_track", "Off track"], ["achieved", "Achieved"], ["closed", "Closed"]] },
      { name: "reviewOn", label: "Next progress review", type: "date" },
    ],
  },
  competences: {
    key: "competences",
    label: "Competence requirements",
    singular: "competence requirement",
    intro: "The training, cards and qualifications each role needs (ISO clause 7.2), and how long they stay valid. Record who holds them under Training records; the matrix shows gaps and expiries.",
    titleField: "title",
    columns: ["category", "appliesTo", "validityMonths"],
    evidenceKind: "ms_competence",
    fields: [
      { name: "title", label: "Training or competence", type: "text", required: true, help: "e.g. CSCS card, SMSTS, IPAF 3a/3b, Asbestos awareness" },
      { name: "category", label: "Type", type: "select", options: [["card_scheme", "Card scheme (CSCS, CPCS, NPORS)"], ["qualification", "Qualification"], ["course", "Course"], ["induction", "Induction"], ["toolbox_talk", "Toolbox talk"], ["authorisation", "Authorisation or permit to work"], ["medical", "Health surveillance"]] },
      { name: "appliesTo", label: "Applies to", type: "text", help: "Roles or job titles, e.g. Site managers, all operatives" },
      { name: "validityMonths", label: "Valid for (months)", type: "number", help: "Leave blank if it does not expire" },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
      { name: "description", label: "Notes", type: "textarea" },
    ],
  },
  "training-records": {
    key: "training-records",
    label: "Training records",
    singular: "training record",
    intro: "Who holds which training, card or qualification, with the certificate as evidence. The expiry date is worked out from the competence's validity when you leave it blank.",
    titleField: "personName",
    columns: ["competenceId", "employer", "completedOn", "expiresOn"],
    evidenceKind: "ms_training_record",
    reminders: [{ field: "expiresOn", label: "Training expiry", ownerField: "personUserId" }],
    fields: [
      { name: "competenceId", label: "Training or competence", type: "row", ref: "competences", required: true },
      { name: "personUserId", label: "Person (user)", type: "person" },
      { name: "personName", label: "Person's name", type: "text", help: "Fill in for people without a login; taken from the user otherwise" },
      { name: "employer", label: "Employer", type: "text", help: "Your company or the subcontractor" },
      { name: "completedOn", label: "Completed or issued on", type: "date" },
      { name: "expiresOn", label: "Expires on", type: "date" },
      { name: "provider", label: "Provider", type: "text" },
      { name: "reference", label: "Card or certificate number", type: "text" },
      { name: "fileId", label: "Certificate", type: "file" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  "inspection-templates": {
    key: "inspection-templates",
    label: "Inspection checklists",
    singular: "inspection checklist",
    intro: "Checklists for site, plant, housekeeping and environmental inspections (ISO clauses 8.1 and 9.1). One item per line.",
    titleField: "title",
    columns: ["frequency", "frameworks"],
    evidenceKind: "ms_inspection_template",
    fields: [
      { name: "title", label: "Checklist", type: "text", required: true, help: "e.g. Weekly site environmental inspection" },
      { name: "items", label: "Items, one per line", type: "textarea", required: true },
      { name: "frequency", label: "Frequency", type: "select", options: [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["quarterly", "Quarterly"], ["as_needed", "As needed"]] },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
    ],
  },
  inspections: {
    key: "inspections",
    label: "Inspections",
    singular: "inspection",
    intro: "Completed inspections against a checklist. Failed items raise one corrective action listing them.",
    titleField: "location",
    columns: ["templateId", "inspectedOn", "inspectorUserId", "status"],
    evidenceKind: "ms_inspection",
    fields: [
      { name: "templateId", label: "Checklist", type: "row", ref: "inspection-templates", required: true },
      { name: "location", label: "Site or area", type: "text", required: true },
      { name: "inspectedOn", label: "Inspected on", type: "date" },
      { name: "inspectorUserId", label: "Inspector", type: "member" },
      { name: "results", label: "Results", type: "checklist" },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: [["completed", "Completed"], ["actions_open", "Actions open"], ["closed", "Closed"]] },
    ],
  },
  complaints: {
    key: "complaints",
    label: "Complaints",
    singular: "complaint",
    intro: "Complaints and feedback from clients, neighbours and others (ISO 9001 9.1.2 and 10.2, ISO 14001 7.4.3), with the response and any corrective action.",
    titleField: "title",
    columns: ["category", "receivedOn", "severity", "status", "ownerUserId"],
    evidenceKind: "ms_complaint",
    fields: [
      { name: "title", label: "Summary", type: "text", required: true },
      { name: "receivedOn", label: "Received on", type: "date" },
      { name: "complainant", label: "From", type: "text", help: "Organisation or role; avoid personal details you do not need" },
      { name: "channel", label: "How it was received", type: "select", options: [["email", "Email"], ["phone", "Phone"], ["letter", "Letter"], ["in_person", "In person"], ["client_report", "Client report"], ["regulator", "Regulator"], ["other", "Other"]] },
      { name: "category", label: "Category", type: "select", options: [["quality", "Quality"], ["environmental", "Environmental"], ["health_safety", "Health and safety"], ["neighbour", "Neighbour or community"], ["service", "Service"], ["other", "Other"]] },
      { name: "severity", label: "Severity", type: "select", options: [["low", "Low"], ["medium", "Medium"], ["high", "High"]] },
      { name: "description", label: "Details", type: "textarea" },
      { name: "response", label: "Response given", type: "textarea" },
      { name: "correctiveActionId", label: "Corrective action", type: "row", ref: "corrective-actions" },
      { name: "ownerUserId", label: "Owner", type: "member" },
      { name: "status", label: "Status", type: "select", options: [["open", "Open"], ["investigating", "Investigating"], ["responded", "Responded"], ["closed", "Closed"]] },
      { name: "closedOn", label: "Closed on", type: "date" },
    ],
  },
  nonconformities: {
    key: "nonconformities",
    label: "Nonconforming outputs",
    singular: "nonconforming output",
    intro: "Work, products or materials that did not meet requirements and what was done with them (ISO 9001 8.7): rework, repair, concession or rejection.",
    titleField: "title",
    columns: ["detectedOn", "location", "disposition", "status", "ownerUserId"],
    evidenceKind: "ms_nonconformity",
    fields: [
      { name: "title", label: "Summary", type: "text", required: true },
      { name: "detectedOn", label: "Found on", type: "date" },
      { name: "location", label: "Site, project or supplier", type: "text" },
      { name: "description", label: "What did not conform", type: "textarea" },
      { name: "disposition", label: "Decision", type: "select", options: [["rework", "Rework"], ["repair", "Repair"], ["concession", "Accepted under concession"], ["reject", "Rejected or scrapped"], ["return_to_supplier", "Returned to supplier"], ["other", "Other"]] },
      { name: "cost", label: "Cost (£)", type: "number" },
      { name: "correctiveActionId", label: "Corrective action", type: "row", ref: "corrective-actions" },
      { name: "ownerUserId", label: "Owner", type: "member" },
      { name: "status", label: "Status", type: "select", options: [["open", "Open"], ["dispositioned", "Decision made"], ["closed", "Closed"]] },
    ],
  },
  "supplier-evaluations": {
    key: "supplier-evaluations",
    label: "Supplier evaluations",
    singular: "supplier evaluation",
    intro: "How suppliers and subcontractors were evaluated and approved (ISO 9001 8.4, ISO 45001 8.1.4, ISO 14001 8.1), and when to evaluate them again.",
    titleField: "supplierName",
    columns: ["approvalStatus", "qualityScore", "safetyScore", "environmentScore", "nextReviewOn"],
    evidenceKind: "ms_supplier_evaluation",
    reminders: [{ field: "nextReviewOn", label: "Supplier re-evaluation", ownerField: "ownerUserId", skipStatuses: ["suspended", "not_approved"] }],
    fields: [
      { name: "supplierName", label: "Supplier or subcontractor", type: "text", required: true },
      { name: "scope", label: "What they supply", type: "text" },
      { name: "criteria", label: "How they were evaluated", type: "textarea", help: "e.g. questionnaire, accreditation checks (CHAS, Constructionline, ISO certificates), references, performance on site" },
      { name: "qualityScore", label: "Quality", type: "score", help: SCORE_HELP },
      { name: "safetyScore", label: "Health and safety", type: "score", help: SCORE_HELP },
      { name: "environmentScore", label: "Environment", type: "score", help: SCORE_HELP },
      { name: "approvalStatus", label: "Approval", type: "select", options: [["approved", "Approved"], ["conditional", "Approved with conditions"], ["not_approved", "Not approved"], ["suspended", "Suspended"]] },
      { name: "evaluatedOn", label: "Evaluated on", type: "date" },
      { name: "nextReviewOn", label: "Next evaluation", type: "date" },
      { name: "ownerUserId", label: "Owner", type: "member" },
      { name: "frameworks", label: "Frameworks", type: "frameworks" },
    ],
  },
  equipment: {
    key: "equipment",
    label: "Equipment and calibration",
    singular: "equipment item",
    intro: "Equipment that needs calibration, inspection, thorough examination or testing (ISO 9001 7.1.5, LOLER, PUWER, PAT), with the certificate and the next due date. The due date is worked out from the interval when you leave it blank.",
    titleField: "name",
    columns: ["identifier", "checkType", "lastCheckedOn", "nextDueOn", "status"],
    evidenceKind: "ms_equipment",
    reminders: [{ field: "nextDueOn", label: "Equipment check", ownerField: "ownerUserId", skipStatuses: ["retired", "quarantined"] }],
    fields: [
      { name: "name", label: "Equipment", type: "text", required: true },
      { name: "identifier", label: "Serial or asset number", type: "text" },
      { name: "equipmentType", label: "Type", type: "select", options: [["measuring", "Measuring or test"], ["monitoring", "Environmental monitoring"], ["lifting", "Lifting equipment or accessory"], ["pressure", "Pressure system"], ["electrical", "Portable electrical"], ["plant", "Plant"], ["safety", "Safety equipment"], ["other", "Other"]] },
      { name: "location", label: "Location or holder", type: "text" },
      { name: "checkType", label: "Check", type: "select", options: [["calibration", "Calibration"], ["inspection", "Inspection"], ["thorough_examination", "Thorough examination (LOLER)"], ["pat", "Portable appliance test"], ["service", "Service"]] },
      { name: "intervalMonths", label: "Interval (months)", type: "number" },
      { name: "lastCheckedOn", label: "Last checked on", type: "date" },
      { name: "nextDueOn", label: "Next due", type: "date" },
      { name: "fileId", label: "Certificate", type: "file" },
      { name: "ownerUserId", label: "Responsible person", type: "member" },
      { name: "status", label: "Status", type: "select", options: [["in_service", "In service"], ["quarantined", "Quarantined"], ["retired", "Retired"]] },
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
    reminders: [{ field: "heldOn", label: "Management review", skipStatuses: ["held"] }],
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
