import { prisma } from "@/lib/db";
import type { NotificationJobData } from "@/lib/jobs/queues/index";
import {
  sendEmail,
  taskAssignedEmail,
  importFailedEmail,
  reportReadyEmail,
  submissionReviewedEmail,
  submissionReceivedEmail,
} from "./email";
import { sendPushToUser } from "./fcm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonsite-rosy.vercel.app";

export async function processNotification(data: NotificationJobData): Promise<void> {
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

  switch (data.type) {
    case "task_assigned": {
      const task = await prisma.reviewTask.findUnique({
        where: { id: data.resourceId },
        select: { type: true, targetId: true },
      });
      if (!task) return;

      const taskType = task.type.replaceAll("_", " ");
      const targetLabel = data.metadata?.targetLabel as string ?? task.targetId;
      const template = taskAssignedEmail({
        recipientName,
        orgName,
        taskType,
        targetLabel,
        appUrl: `${APP_URL}/orgs/${data.orgId}/dashboard`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(data.recipientUserId, {
          title: "Review task assigned",
          body: `A ${taskType} task has been assigned to you in ${orgName}.`,
          data: { type: "task_assigned", taskId: data.resourceId, orgId: data.orgId },
        }),
      ]);
      break;
    }

    case "import_failed": {
      const batch = await prisma.importBatch.findUnique({
        where: { id: data.resourceId },
        select: { sourceFilename: true, errorCount: true },
      });
      if (!batch) return;

      const template = importFailedEmail({
        recipientName,
        orgName,
        filename: batch.sourceFilename,
        errorCount: batch.errorCount,
        appUrl: `${APP_URL}/orgs/${data.orgId}/imports`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(data.recipientUserId, {
          title: "Import needs attention",
          body: `${batch.sourceFilename} failed to import — ${batch.errorCount} error${batch.errorCount !== 1 ? "s" : ""}.`,
          data: { type: "import_failed", importId: data.resourceId, orgId: data.orgId },
        }),
      ]);
      break;
    }

    case "report_ready": {
      const reportLabel = data.metadata?.reportLabel as string ?? "Report";
      const template = reportReadyEmail({
        recipientName,
        orgName,
        reportLabel,
        appUrl: `${APP_URL}/orgs/${data.orgId}/reports`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(data.recipientUserId, {
          title: "Report ready",
          body: `Your ${reportLabel.toLowerCase()} is ready to download.`,
          data: { type: "report_ready", reportId: data.resourceId, orgId: data.orgId },
        }),
      ]);
      break;
    }

    case "submission_reviewed": {
      const submission = await prisma.fieldSubmission.findUnique({
        where: { id: data.resourceId },
        select: { status: true, reviewNote: true },
      });
      if (!submission) return;

      const template = submissionReviewedEmail({
        recipientName,
        orgName,
        status: submission.status,
        reviewNote: submission.reviewNote ?? undefined,
        appUrl: `${APP_URL}/orgs/${data.orgId}/submissions/${data.resourceId}`,
      });

      const statusLabel = submission.status === "approved" ? "approved" : "needs attention";
      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(data.recipientUserId, {
          title: `Submission ${statusLabel}`,
          body: submission.status === "approved"
            ? `Your submission has been approved by ${orgName}.`
            : `Your submission from ${orgName} needs attention — ${submission.reviewNote ?? "check the app for details"}.`,
          data: {
            type: "submission_reviewed",
            submissionId: data.resourceId,
            orgId: data.orgId,
            status: submission.status,
          },
        }),
      ]);
      break;
    }

    case "submission_received": {
      const submission = await prisma.fieldSubmission.findUnique({
        where: { id: data.resourceId },
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
        appUrl: `${APP_URL}/orgs/${data.orgId}/submissions/${data.resourceId}`,
      });

      await Promise.all([
        sendEmail({ to: recipient.email, ...template }),
        sendPushToUser(data.recipientUserId, {
          title: "New field submission",
          body: `${submitter} submitted a ${docLabel}${submission.site ? ` at ${submission.site.name}` : ""}.`,
          data: {
            type: "submission_received",
            submissionId: data.resourceId,
            orgId: data.orgId,
          },
        }),
      ]);
      break;
    }

    default:
      console.warn("[notifications] Unknown notification type:", data.type);
  }
}
