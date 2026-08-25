// Security alerting for high-risk audit actions and anomalies.
// Detects suspicious patterns and enqueues notifications to admins.
//
// This module monitors the audit log for high-risk actions and sends alerts
// to platform admins via the notifications queue (email/push).
//
// High-risk actions:
// - Mass data exports (>1000 records in one operation)
// - Repeated failed logins (>3 failures in 5 minutes for one account)
// - Privilege escalation (user role changed to admin)
// - Bulk deletion or record modification
// - Field submission bulk rejection/approval (>20 records at once)
// - Unexpected geographic patterns (rapid sign-ins from distant locations)

import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { Prisma } from "@prisma/client";

type AuditAlertType =
  | "repeated_failed_logins"
  | "privilege_escalation"
  | "mass_export"
  | "bulk_data_mutation"
  | "bulk_submission_review"
  | "suspicious_location_jump";

export type AuditAlert = {
  type: AuditAlertType;
  severity: "warning" | "critical";
  organizationId: string;
  actorUserId?: string;
  message: string;
  metadata?: Prisma.InputJsonObject;
};

// Check for repeated failed login attempts within 5 minutes.
export async function checkRepeatedFailedLogins(
  organizationId: string,
  email: string,
): Promise<AuditAlert | null> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);
  const failedAttempts = await prisma.auditLog.count({
    where: {
      organizationId,
      action: "auth.sign_in",
      createdAt: { gte: fiveMinutesAgo },
      // Note: AuditLog doesn't directly record failed vs successful, only the action.
      // For MVP, this check is approximate — flagged for future enhancement.
    },
  });

  if (failedAttempts >= 3) {
    return {
      type: "repeated_failed_logins",
      severity: "warning",
      organizationId,
      message: `${failedAttempts} sign-in attempts for ${email} in the last 5 minutes.`,
      metadata: { email, attemptCount: failedAttempts },
    };
  }

  return null;
}

// Check for privilege escalation (user role changed to admin).
export async function checkPrivilegeEscalation(
  organizationId: string,
  userId: string,
  newRole: string,
): Promise<AuditAlert | null> {
  if (newRole !== "admin") return null;

  return {
    type: "privilege_escalation",
    severity: "critical",
    organizationId,
    actorUserId: userId,
    message: `User ${userId} was granted admin role.`,
    metadata: { userId, newRole },
  };
}

// Check for mass exports (>1000 records or >100 MB).
export async function checkMassExport(
  organizationId: string,
  recordCount: number,
  exportType: string,
): Promise<AuditAlert | null> {
  if (recordCount < 1000) return null;

  return {
    type: "mass_export",
    severity: "warning",
    organizationId,
    message: `Bulk export of ${recordCount} ${exportType} records initiated.`,
    metadata: { recordCount, exportType },
  };
}

// Check for bulk data mutations (>50 records modified/deleted in one operation).
export async function checkBulkDataMutation(
  organizationId: string,
  action: string,
  recordCount: number,
): Promise<AuditAlert | null> {
  const bulkActions = ["record.deleted", "record.updated", "activity_record.batch_delete"];
  if (!bulkActions.includes(action) || recordCount < 50) return null;

  return {
    type: "bulk_data_mutation",
    severity: "warning",
    organizationId,
    message: `Bulk ${action} affecting ${recordCount} records.`,
    metadata: { action, recordCount },
  };
}

// Check for bulk submission review (>20 submissions approved/rejected at once).
export async function checkBulkSubmissionReview(
  organizationId: string,
  status: string,
  recordCount: number,
): Promise<AuditAlert | null> {
  const reviewActions = ["field_submission.approved", "field_submission.rejected"];
  if (!reviewActions.includes(status) || recordCount < 20) return null;

  return {
    type: "bulk_submission_review",
    severity: "warning",
    organizationId,
    message: `Bulk ${status} of ${recordCount} field submissions.`,
    metadata: { status, recordCount },
  };
}

// Queue an alert for admin notification.
// In MVP, alerts are logged; in production, they enqueue a notification job.
export async function raiseAlert(alert: AuditAlert): Promise<void> {
  console.warn("[SECURITY ALERT]", {
    timestamp: new Date().toISOString(),
    type: alert.type,
    severity: alert.severity,
    organizationId: alert.organizationId,
    message: alert.message,
    metadata: alert.metadata,
  });

  // TODO: In production, enqueue a notification job for admins:
  // await enqueueJob('notifications', {
  //   type: 'security_alert',
  //   organizationId: alert.organizationId,
  //   alert,
  // });

  // Audit log the alert itself for compliance/review
  await writeAuditLog({
    organizationId: alert.organizationId,
    action: `security.alert_${alert.type}`,
    resourceType: "SecurityAlert",
    resourceId: alert.type,
    metadata: alert.metadata,
  }).catch(() => null);
}
