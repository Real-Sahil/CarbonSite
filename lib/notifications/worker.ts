import { prisma } from "@/lib/db";
import type { NotificationJobData } from "@/lib/jobs/queues/index";
import {
  sendEmail,
  taskAssignedEmail,
  importFailedEmail,
  reportReadyEmail,
  submissionReviewedEmail,
} from "./email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonsite.app";

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

      const template = taskAssignedEmail({
        recipientName,
        orgName,
        taskType: task.type.replaceAll("_", " "),
        targetLabel: data.metadata?.targetLabel as string ?? task.targetId,
        appUrl: `${APP_URL}/orgs/${data.orgId}/dashboard`,
      });

      await sendEmail({ to: recipient.email, ...template });
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

      await sendEmail({ to: recipient.email, ...template });
      break;
    }

    case "report_ready": {
      const template = reportReadyEmail({
        recipientName,
        orgName,
        reportLabel: data.metadata?.reportLabel as string ?? "Report",
        appUrl: `${APP_URL}/orgs/${data.orgId}/reports`,
      });

      await sendEmail({ to: recipient.email, ...template });
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

      await sendEmail({ to: recipient.email, ...template });
      break;
    }

    default:
      console.warn("[notifications] Unknown notification type:", data.type);
  }
}
