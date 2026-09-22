export type StructuredFormKey =
  | "hs-incident-reports"
  | "environmental-incidents"
  | "environmental-permits"
  | "assurance-engagements"
  | "biodiversity-assessments";

type Tone = "neutral" | "active" | "warning" | "done" | "stopped";

export interface FormWorkflow {
  noun: string;
  statuses: Record<string, { label: string; tone: Tone }>;
  transitions: Record<string, Array<{ to: string; label: string }>>;
  /** Content is read-only in these statuses. */
  lockStatuses: string[];
  /** Status changes go through the domain route so its guards (closure checks, net gain, sign-off readiness) always apply. */
  statusUrl: (orgId: string, id: string) => string;
  revise: null | {
    label: string;
    confirm: string;
    from: string[];
    /** "in_place" keeps one register entry; "new_record" creates a successor and supersedes the source. */
    mode: "in_place" | "new_record";
    reopenTo?: string;
  };
}

export const WORKFLOWS: Record<StructuredFormKey, FormWorkflow> = {
  "hs-incident-reports": {
    noun: "incident",
    statuses: {
      reported: { label: "Reported", tone: "warning" },
      investigating: { label: "Investigating", tone: "active" },
      action_required: { label: "Action required", tone: "warning" },
      closed: { label: "Closed", tone: "done" },
    },
    transitions: {
      reported: [{ to: "investigating", label: "Start investigation" }],
      investigating: [
        { to: "action_required", label: "Actions required" },
        { to: "closed", label: "Close incident" },
      ],
      action_required: [
        { to: "investigating", label: "Back to investigation" },
        { to: "closed", label: "Close incident" },
      ],
    },
    lockStatuses: ["closed"],
    statusUrl: (orgId, id) => `/api/orgs/${orgId}/hs-incidents/${id}`,
    revise: {
      label: "Reopen incident",
      confirm: "Reopen this incident? It moves back to Investigating and the version number goes up.",
      from: ["closed"],
      mode: "in_place",
      reopenTo: "investigating",
    },
  },
  "environmental-incidents": {
    noun: "incident",
    statuses: {
      reported: { label: "Reported", tone: "warning" },
      investigating: { label: "Investigating", tone: "active" },
      contained: { label: "Contained", tone: "active" },
      awaiting_action: { label: "Awaiting action", tone: "warning" },
      closed: { label: "Closed", tone: "done" },
    },
    transitions: {
      reported: [{ to: "investigating", label: "Start investigation" }],
      investigating: [
        { to: "contained", label: "Mark contained" },
        { to: "awaiting_action", label: "Actions outstanding" },
        { to: "closed", label: "Close incident" },
      ],
      contained: [
        { to: "awaiting_action", label: "Actions outstanding" },
        { to: "closed", label: "Close incident" },
      ],
      awaiting_action: [{ to: "closed", label: "Close incident" }],
    },
    lockStatuses: ["closed"],
    statusUrl: (orgId, id) => `/api/orgs/${orgId}/incidents/${id}`,
    revise: {
      label: "Reopen incident",
      confirm: "Reopen this incident? It moves back to Investigating and the version number goes up.",
      from: ["closed"],
      mode: "in_place",
      reopenTo: "investigating",
    },
  },
  "environmental-permits": {
    noun: "permit",
    statuses: {
      draft: { label: "Draft", tone: "neutral" },
      applied: { label: "Applied", tone: "warning" },
      active: { label: "Active", tone: "done" },
      suspended: { label: "Suspended", tone: "warning" },
      expired: { label: "Expired", tone: "stopped" },
      revoked: { label: "Revoked", tone: "stopped" },
      surrendered: { label: "Surrendered", tone: "stopped" },
    },
    transitions: {
      draft: [{ to: "applied", label: "Mark applied" }],
      applied: [
        { to: "active", label: "Permit granted" },
        { to: "draft", label: "Back to draft" },
      ],
      active: [
        { to: "suspended", label: "Suspend" },
        { to: "surrendered", label: "Surrender" },
        { to: "revoked", label: "Revoked" },
        { to: "expired", label: "Expired" },
      ],
      suspended: [
        { to: "active", label: "Reinstate" },
        { to: "surrendered", label: "Surrender" },
        { to: "revoked", label: "Revoked" },
      ],
    },
    lockStatuses: ["expired", "revoked", "surrendered"],
    statusUrl: (orgId, id) => `/api/orgs/${orgId}/permits/${id}`,
    revise: {
      label: "Record variation",
      confirm: "Record a permit variation? The version number goes up and the change is logged. The permit stays active.",
      from: ["active", "suspended"],
      mode: "in_place",
    },
  },
  "assurance-engagements": {
    noun: "engagement",
    statuses: {
      planning: { label: "Planning", tone: "neutral" },
      fieldwork: { label: "Fieldwork", tone: "active" },
      review: { label: "Review", tone: "warning" },
      signed: { label: "Opinion signed", tone: "done" },
      withdrawn: { label: "Withdrawn", tone: "stopped" },
    },
    transitions: {
      planning: [
        { to: "fieldwork", label: "Start fieldwork" },
        { to: "withdrawn", label: "Withdraw" },
      ],
      fieldwork: [
        { to: "review", label: "Move to review" },
        { to: "withdrawn", label: "Withdraw" },
      ],
      review: [
        { to: "signed", label: "Sign opinion" },
        { to: "fieldwork", label: "Back to fieldwork" },
        { to: "withdrawn", label: "Withdraw" },
      ],
    },
    lockStatuses: ["signed", "withdrawn"],
    statusUrl: (orgId, id) => `/api/orgs/${orgId}/assurance/engagements/${id}`,
    // A signed opinion is final. A correction means a new engagement, not an edited opinion.
    revise: null,
  },
  "biodiversity-assessments": {
    noun: "assessment",
    statuses: {
      draft: { label: "Draft", tone: "neutral" },
      submitted: { label: "Submitted to planning", tone: "warning" },
      approved: { label: "Approved", tone: "done" },
      superseded: { label: "Superseded", tone: "stopped" },
    },
    transitions: {
      draft: [{ to: "submitted", label: "Submit to planning authority" }],
      submitted: [
        { to: "approved", label: "Mark approved" },
        { to: "draft", label: "Back to draft" },
      ],
    },
    lockStatuses: ["approved", "superseded"],
    statusUrl: (orgId, id) => `/api/orgs/${orgId}/biodiversity/${id}`,
    revise: {
      label: "Start new metric version",
      confirm: "Start a new version of this assessment? Habitat parcels are copied into a new draft and this version is marked superseded.",
      from: ["approved"],
      mode: "new_record",
    },
  },
};

export function isLockedStatus(form: StructuredFormKey, status: string): boolean {
  return WORKFLOWS[form].lockStatuses.includes(status);
}

export function nextMajorVersion(version: string): string {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return `${Number.isFinite(major) ? major + 1 : 2}.0`;
}
