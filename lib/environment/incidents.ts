// Environmental incident register.
//
// Two rules make this register worth keeping rather than a list of prose:
// severity drives whether the regulator must be told, and an incident cannot
// close while corrective actions remain open. Both are enforced here so the
// API and the UI cannot disagree about them.

import type {
  IncidentSeverity,
  IncidentType,
  IncidentStatus,
  CorrectiveActionStatus,
} from "@prisma/client";

/**
 * Severities that carry a default expectation of notifying the regulator.
 * The operator can always override upward; what this prevents is a major
 * incident being logged with notification silently left off.
 */
const NOTIFIABLE_SEVERITIES: ReadonlySet<IncidentSeverity> = new Set<IncidentSeverity>([
  "major",
  "severe",
]);

/**
 * Incident types that are notifiable at a lower severity because the release
 * itself is the regulated event, not its consequence.
 */
const ALWAYS_ASSESS_TYPES: ReadonlySet<IncidentType> = new Set<IncidentType>([
  "unauthorised_release",
  "exceedance",
  "ecological_damage",
]);

/**
 * Whether an incident should default to regulator-notifiable.
 * Moderate unauthorised releases and permit exceedances are included because
 * the duty to report those usually attaches to the breach, not to the harm.
 */
export function defaultRegulatorNotifiable(
  type: IncidentType,
  severity: IncidentSeverity,
): boolean {
  if (NOTIFIABLE_SEVERITIES.has(severity)) return true;
  return ALWAYS_ASSESS_TYPES.has(type) && severity === "moderate";
}

/** Target hours to notify the regulator, by severity. Null where none applies. */
export function notificationTargetHours(severity: IncidentSeverity): number | null {
  switch (severity) {
    case "severe":
      return 24;
    case "major":
      return 72;
    default:
      return null;
  }
}

export interface NotificationBreach {
  isOverdue: boolean;
  hoursElapsed: number;
  targetHours: number | null;
}

/**
 * Whether a notifiable incident has gone past its notification window without
 * the regulator being told. This is the single most consequential number on
 * the register: a late notification is itself an offence in most regimes.
 */
export function assessNotificationTimeliness(params: {
  severity: IncidentSeverity;
  regulatorNotifiable: boolean;
  occurredAt: Date;
  discoveredAt: Date | null;
  regulatorNotifiedAt: Date | null;
  now?: Date;
}): NotificationBreach {
  const now = params.now ?? new Date();
  const target = notificationTargetHours(params.severity);

  // The clock runs from discovery where that is recorded, since a spill found
  // three days later cannot have been reported before it was known about.
  const start = params.discoveredAt ?? params.occurredAt;
  const end = params.regulatorNotifiedAt ?? now;
  const hoursElapsed = Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);

  if (!params.regulatorNotifiable || target === null) {
    return { isOverdue: false, hoursElapsed, targetHours: target };
  }

  return {
    isOverdue: params.regulatorNotifiedAt === null && hoursElapsed > target,
    hoursElapsed,
    targetHours: target,
  };
}

const OPEN_ACTION_STATUSES: ReadonlySet<CorrectiveActionStatus> = new Set<CorrectiveActionStatus>([
  "open",
  "in_progress",
  "awaiting_verification",
  "overdue",
]);

export function isActionOpen(status: CorrectiveActionStatus): boolean {
  return OPEN_ACTION_STATUSES.has(status);
}

export interface ClosureCheck {
  canClose: boolean;
  reasons: string[];
}

/**
 * Whether an incident may be closed.
 *
 * Closing an incident with open actions is the commonest way a register stops
 * meaning anything, so this is a hard gate rather than a warning.
 */
export function canCloseIncident(incident: {
  rootCause: string | null;
  regulatorNotifiable: boolean;
  regulatorNotifiedAt: Date | null;
  actions: Array<{ status: CorrectiveActionStatus }>;
}): ClosureCheck {
  const reasons: string[] = [];

  const openActions = incident.actions.filter((a) => isActionOpen(a.status));
  if (openActions.length > 0) {
    reasons.push(
      `${openActions.length} corrective ${openActions.length === 1 ? "action is" : "actions are"} still open.`,
    );
  }

  if (!incident.rootCause || incident.rootCause.trim().length < 10) {
    reasons.push("Root cause has not been recorded.");
  }

  if (incident.regulatorNotifiable && !incident.regulatorNotifiedAt) {
    reasons.push("Incident is notifiable but the regulator has not been recorded as notified.");
  }

  return { canClose: reasons.length === 0, reasons };
}

/** Marks an action overdue when its due date has passed and it is not done. */
export function deriveActionStatus(
  action: { status: CorrectiveActionStatus; dueOn: Date | null },
  now: Date = new Date(),
): CorrectiveActionStatus {
  if (action.status === "verified" || action.status === "cancelled") return action.status;
  if (action.dueOn && action.dueOn.getTime() < now.getTime() && isActionOpen(action.status)) {
    return "overdue";
  }
  return action.status;
}

export interface IncidentRegisterSummary {
  total: number;
  open: number;
  closed: number;
  bySeverity: Record<IncidentSeverity, number>;
  /// Notifiable incidents past their notification window and not yet reported.
  overdueNotifications: number;
  openActions: number;
  overdueActions: number;
}

export function summariseIncidentRegister(
  incidents: Array<{
    severity: IncidentSeverity;
    status: IncidentStatus;
    regulatorNotifiable: boolean;
    occurredAt: Date;
    discoveredAt: Date | null;
    regulatorNotifiedAt: Date | null;
    actions: Array<{ status: CorrectiveActionStatus; dueOn: Date | null }>;
  }>,
  now: Date = new Date(),
): IncidentRegisterSummary {
  const summary: IncidentRegisterSummary = {
    total: incidents.length,
    open: 0,
    closed: 0,
    bySeverity: { negligible: 0, minor: 0, moderate: 0, major: 0, severe: 0 },
    overdueNotifications: 0,
    openActions: 0,
    overdueActions: 0,
  };

  for (const incident of incidents) {
    summary.bySeverity[incident.severity] += 1;
    if (incident.status === "closed") summary.closed += 1;
    else summary.open += 1;

    const timeliness = assessNotificationTimeliness({ ...incident, now });
    if (timeliness.isOverdue) summary.overdueNotifications += 1;

    for (const action of incident.actions) {
      const status = deriveActionStatus(action, now);
      if (isActionOpen(status)) summary.openActions += 1;
      if (status === "overdue") summary.overdueActions += 1;
    }
  }

  return summary;
}

/**
 * Next sequential reference for an organisation, in the form INC-2026-0007.
 * Sequence is per calendar year so references stay short and sortable.
 */
export function nextIncidentReference(
  existingReferences: string[],
  now: Date = new Date(),
): string {
  const year = now.getFullYear();
  const prefix = `INC-${year}-`;

  let highest = 0;
  for (const ref of existingReferences) {
    if (!ref.startsWith(prefix)) continue;
    const n = Number.parseInt(ref.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > highest) highest = n;
  }

  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}
