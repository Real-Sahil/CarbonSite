import type { NotificationJobData } from "@/lib/jobs/queues/index";

export interface NotificationPresentation {
  title: string;
  body: string;
  /** In-app deep link (path relative to the app root), or null. */
  link: string | null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Derives the in-app notification centre copy for a notification job. Pure and
 * dependency-free so it can back both the persisted feed row and (future) any
 * preview surface. Mirrors the push-notification phrasing in `worker.ts`, but
 * derived only from the job payload (type, resourceId, metadata) so it never
 * needs a database read.
 */
export function notificationPresentation(data: NotificationJobData): NotificationPresentation {
  const orgBase = `/orgs/${data.orgId}`;

  switch (data.type) {
    case "task_assigned": {
      const targetLabel = str(data.metadata?.targetLabel, "a record");
      return {
        title: "Review task assigned",
        body: `A review task for ${targetLabel} has been assigned to you.`,
        link: `${orgBase}/dashboard`,
      };
    }
    case "import_failed":
      return {
        title: "Import needs attention",
        body: "An import failed and needs your review.",
        link: `${orgBase}/imports`,
      };
    case "report_ready": {
      const reportLabel = str(data.metadata?.reportLabel, "Report");
      return {
        title: "Report ready",
        body: `Your ${reportLabel.toLowerCase()} is ready to download.`,
        link: `${orgBase}/reports`,
      };
    }
    case "submission_reviewed": {
      const status = str(data.metadata?.status, "");
      const reviewed = status === "approved" ? "approved" : "reviewed";
      return {
        title: `Submission ${reviewed}`,
        body: `Your field submission has been ${reviewed}.`,
        link: `${orgBase}/submissions/${data.resourceId}`,
      };
    }
    case "submission_received": {
      const submitter = str(data.metadata?.submitterLabel, "A field worker");
      const docLabel = str(data.metadata?.documentLabel, "document");
      return {
        title: "New field submission",
        body: `${submitter} submitted a ${docLabel} for review.`,
        link: `${orgBase}/submissions/${data.resourceId}`,
      };
    }
    case "supplier_password_expiring": {
      const days = num(data.metadata?.daysRemaining, 7);
      return {
        title: "Password change due",
        body: days <= 0
          ? "Your password is due for a change."
          : `Your password is due for a change in ${days} day${days !== 1 ? "s" : ""}.`,
        link: `/forgot-password`,
      };
    }
    case "supplier_account_terminated":
      return {
        title: "Account closed",
        body: "Your supplier account has been closed.",
        link: null,
      };
    case "supplier_account_expiring": {
      const days = num(data.metadata?.daysRemaining, 14);
      return {
        title: "Account access expiring",
        body: `Your supplier access expires in ${days} day${days !== 1 ? "s" : ""}.`,
        link: `${orgBase}/dashboard`,
      };
    }
    case "dsar_sla_alert": {
      const days = num(data.metadata?.daysRemaining, 3);
      const subject = str(data.metadata?.subjectEmail, "a data subject");
      return {
        title: `DSAR deadline: ${days}d remaining`,
        body: `The DSAR for ${subject} must be resolved within ${days} day${days !== 1 ? "s" : ""}.`,
        link: `${orgBase}/compliance/dsar/${data.resourceId}`,
      };
    }
    case "security_alert": {
      const alertType = str(data.metadata?.alertType, "Suspicious activity");
      const detail = str(data.metadata?.detail, "Review your account activity.");
      return {
        title: `Security alert: ${alertType}`,
        body: detail,
        link: `${orgBase}/settings/audit`,
      };
    }
    case "submission_sla_overdue": {
      const count = num(data.metadata?.overdueCount, 1);
      return {
        title: "Submissions overdue for review",
        body: `${count} submission${count !== 1 ? "s have" : " has"} been pending review for more than 48 hours.`,
        link: `${orgBase}/submissions?status=submitted`,
      };
    }
    case "permit_expiry_warning": {
      const permitRef = str(data.metadata?.permitRef, "a permit");
      const days = num(data.metadata?.daysUntilExpiry, 30);
      return {
        title: `Permit expiring in ${days}d`,
        body: `Permit ${permitRef} expires in ${days} day${days !== 1 ? "s" : ""}. Renew before the deadline.`,
        link: `${orgBase}/compliance/permits/${data.resourceId}`,
      };
    }
    case "permit_condition_due": {
      const conditionRef = str(data.metadata?.conditionRef, "a condition");
      const days = num(data.metadata?.daysUntilDue, 7);
      return {
        title: `Permit condition due in ${days}d`,
        body: `Condition ${conditionRef} is due for compliance assessment in ${days} day${days !== 1 ? "s" : ""}.`,
        link: `${orgBase}/compliance/permits/${data.resourceId}`,
      };
    }
    case "worker_session_overdue": {
      const workerName = str(data.metadata?.workerName, "A worker");
      const minutes = num(data.metadata?.minutesSinceLastPing, 30);
      return {
        title: "Worker welfare check overdue",
        body: `${workerName} has not responded to a welfare ping in ${minutes} minutes. Check their status.`,
        link: `${orgBase}/hs/worker-sessions/${data.resourceId}`,
      };
    }
    case "enforcement_notice_overdue": {
      const ref = str(data.metadata?.noticeRef, "an enforcement notice");
      return {
        title: "Enforcement notice compliance overdue",
        body: `Compliance deadline for notice ${ref} has passed without a recorded compliance date.`,
        link: `${orgBase}/compliance/enforcement-notices/${data.resourceId}`,
      };
    }
    case "discharge_reading_exceedance": {
      const parameter = str(data.metadata?.parameter, "a parameter");
      const permitRef = str(data.metadata?.permitRef, "permit");
      return {
        title: "Discharge limit exceeded",
        body: `${parameter} exceeded its consented limit on ${permitRef}. Regulatory notification may be required.`,
        link: `${orgBase}/compliance/permits/${data.resourceId}`,
      };
    }
    case "supplier_certification_expiring": {
      const cert = str(data.metadata?.certType, "certification");
      const supplierName = str(data.metadata?.supplierName, "a supplier");
      const days = num(data.metadata?.daysRemaining, 30);
      return {
        title: `Supplier ${cert} expiring`,
        body: `${supplierName}'s ${cert} expires in ${days} day${days !== 1 ? "s" : ""}.`,
        link: `${orgBase}/supply-chain/suppliers/${data.resourceId}`,
      };
    }
  }
}
