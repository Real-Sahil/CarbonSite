import { prisma } from "@/lib/db";
import type { NotificationJobData } from "@/lib/jobs/queues/index";
import { notificationLogger } from "@/lib/logger";
import { match } from "ts-pattern";
import {
  sendEmail,
  taskAssignedEmail,
  importFailedEmail,
  reportReadyEmail,
  submissionReviewedEmail,
  submissionReceivedEmail,
  supplierPasswordExpiringEmail,
  supplierAccountTerminatedEmail,
  supplierAccountExpiringEmail,
  dsarSlaAlertEmail,
  securityAlertEmail,
} from "./email";
import { sendPushToUser } from "./fcm";
import { notificationPresentation } from "./presentation";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://metricora-rosy.vercel.app";

// Persist an in-app copy so the notification centre always has the item, even
// if the email/push channels below fail. Failures here are logged, never thrown,
// so they can't block delivery of the other channels.
async function persistInApp(data: NotificationJobData): Promise<void> {
  try {
    const { title, body, link } = notificationPresentation(data);
    await prisma.notification.create({
      data: {
        organizationId: data.orgId,
        userId: data.recipientUserId,
        type: data.type,
        title,
        body,
        link,
        resourceId: data.resourceId,
      },
    });
  } catch (err) {
    notificationLogger.error("Failed to persist in-app notification", {
      type: data.type,
      recipientUserId: data.recipientUserId,
      orgId: data.orgId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function processNotification(data: NotificationJobData): Promise<void> {
  await persistInApp(data);

  const recipient = await prisma.user.findUnique({
    where: { id: data.recipientUserId },
    select: { name: true, email: true },
  });
  if (!recipient) return;

  const org = await prisma.organization.findUnique({
    where: { id: data.orgId },
    select: { name: true },
  });
  const orgName = org?.name ?? "your organisation";
  const recipientName = recipient.name ?? recipient.email;

  await match(data)
    .with({ type: "task_assigned" }, async (d) => {
      const task = await prisma.reviewTask.findUnique({
        where: { id: d.resourceId },
        select: { type: true, targetId: true },
      });
      if (!task) return;

      const taskType = task.type.replaceAll("_", " ");
      const targetLabel = d.metadata?.targetLabel as string ?? task.targetId;
      const template = taskAssignedEmail({
        recipientName,
        orgName,
        taskType,
        targetLabel,
        appUrl: `${APP_URL}/orgs/${d.orgId}/dashboard`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(d.recipientUserId, {
          title: "Review task assigned",
          body: `A ${taskType} task has been assigned to you in ${orgName}.`,
          data: { type: "task_assigned", taskId: d.resourceId, orgId: d.orgId },
        }),
      ]);
    })

    .with({ type: "import_failed" }, async (d) => {
      const batch = await prisma.importBatch.findUnique({
        where: { id: d.resourceId },
        select: { sourceFilename: true, errorCount: true },
      });
      if (!batch) return;

      const template = importFailedEmail({
        recipientName,
        orgName,
        filename: batch.sourceFilename,
        errorCount: batch.errorCount,
        appUrl: `${APP_URL}/orgs/${d.orgId}/imports`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(d.recipientUserId, {
          title: "Import needs attention",
          body: `${batch.sourceFilename} failed to import — ${batch.errorCount} error${batch.errorCount !== 1 ? "s" : ""}.`,
          data: { type: "import_failed", importId: d.resourceId, orgId: d.orgId },
        }),
      ]);
    })

    .with({ type: "report_ready" }, async (d) => {
      const reportLabel = d.metadata?.reportLabel as string ?? "Report";
      const template = reportReadyEmail({
        recipientName,
        orgName,
        reportLabel,
        appUrl: `${APP_URL}/orgs/${d.orgId}/reports`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(d.recipientUserId, {
          title: "Report ready",
          body: `Your ${reportLabel.toLowerCase()} is ready to download.`,
          data: { type: "report_ready", reportId: d.resourceId, orgId: d.orgId },
        }),
      ]);
    })

    .with({ type: "submission_reviewed" }, async (d) => {
      const submission = await prisma.fieldSubmission.findUnique({
        where: { id: d.resourceId },
        select: { status: true, reviewNote: true },
      });
      if (!submission) return;

      const template = submissionReviewedEmail({
        recipientName,
        orgName,
        status: submission.status,
        reviewNote: submission.reviewNote ?? undefined,
        appUrl: `${APP_URL}/orgs/${d.orgId}/submissions/${d.resourceId}`,
      });

      const statusLabel = submission.status === "approved" ? "approved" : "needs attention";
      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(d.recipientUserId, {
          title: `Submission ${statusLabel}`,
          body: submission.status === "approved"
            ? `Your submission has been approved by ${orgName}.`
            : `Your submission from ${orgName} needs attention — ${submission.reviewNote ?? "check the app for details"}.`,
          data: {
            type: "submission_reviewed",
            submissionId: d.resourceId,
            orgId: d.orgId,
            status: submission.status,
          },
        }),
      ]);
    })

    .with({ type: "submission_received" }, async (d) => {
      const submission = await prisma.fieldSubmission.findUnique({
        where: { id: d.resourceId },
        select: {
          documentType: true,
          submittedBy: { select: { name: true, email: true } },
          site: { select: { name: true } },
        },
      });
      if (!submission) return;

      const docLabel = submission.documentType.replaceAll("_", " ");
      const submitter = submission.submittedBy.name ?? submission.submittedBy.email;
      const template = submissionReceivedEmail({
        recipientName,
        orgName,
        submitterLabel: submitter,
        documentLabel: docLabel,
        siteLabel: submission.site?.name ?? null,
        appUrl: `${APP_URL}/orgs/${d.orgId}/submissions/${d.resourceId}`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(d.recipientUserId, {
          title: "New field submission",
          body: `${submitter} submitted a ${docLabel}${submission.site ? ` at ${submission.site.name}` : ""}.`,
          data: { type: "submission_received", submissionId: d.resourceId, orgId: d.orgId },
        }),
      ]);
    })

    .with({ type: "supplier_password_expiring" }, async (d) => {
      const daysRemaining = d.metadata?.daysRemaining as number ?? 7;
      const template = supplierPasswordExpiringEmail({
        recipientName,
        orgName,
        daysRemaining,
        appUrl: `${APP_URL}/settings/security`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(d.recipientUserId, {
          title: "Password expiring soon",
          body: `Your MetricOra password expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}. Update it now.`,
          data: { type: "supplier_password_expiring", orgId: d.orgId },
        }),
      ]);
    })

    .with({ type: "supplier_account_terminated" }, async (d) => {
      const template = supplierAccountTerminatedEmail({ recipientName, orgName });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(d.recipientUserId, {
          title: "Account closed",
          body: `Your supplier account with ${orgName} has been closed.`,
          data: { type: "supplier_account_terminated", orgId: d.orgId },
        }),
      ]);
    })

    .with({ type: "supplier_account_expiring" }, async (d) => {
      const daysRemaining = d.metadata?.daysRemaining as number ?? 14;
      const template = supplierAccountExpiringEmail({
        recipientName,
        orgName,
        daysRemaining,
        appUrl: `${APP_URL}/orgs/${d.orgId}/dashboard`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(d.recipientUserId, {
          title: "Account access expiring",
          body: `Your supplier access to ${orgName} expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}.`,
          data: { type: "supplier_account_expiring", orgId: d.orgId },
        }),
      ]);
    })

    .with({ type: "dsar_sla_alert" }, async (d) => {
      const daysRemaining = d.metadata?.daysRemaining as number ?? 3;
      const subjectEmail = d.metadata?.subjectEmail as string ?? "unknown subject";
      const template = dsarSlaAlertEmail({
        recipientName,
        orgName,
        subjectEmail,
        daysRemaining,
        requestId: d.resourceId,
        appUrl: `${APP_URL}/orgs/${d.orgId}/compliance/dsar/${d.resourceId}`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(d.recipientUserId, {
          title: `DSAR deadline: ${daysRemaining}d remaining`,
          body: `DSAR for ${subjectEmail} must be resolved within ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}.`,
          data: { type: "dsar_sla_alert", requestId: d.resourceId, orgId: d.orgId },
        }),
      ]);
    })

    .with({ type: "security_alert" }, async (d) => {
      const alertType = d.metadata?.alertType as string ?? "Suspicious activity";
      const detail = d.metadata?.detail as string ?? "Review your account activity.";
      const template = securityAlertEmail({
        recipientName,
        orgName,
        alertType,
        detail,
        appUrl: `${APP_URL}/orgs/${d.orgId}/settings/security`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(d.recipientUserId, {
          title: `Security alert: ${alertType}`,
          body: detail,
          data: { type: "security_alert", orgId: d.orgId },
        }),
      ]);
    })

    .exhaustive();

  notificationLogger.info("Notification processed", {
    type: data.type,
    recipientUserId: data.recipientUserId,
    orgId: data.orgId,
  });
}
