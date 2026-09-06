import type { NotificationJobData } from "@/lib/jobs/queues";

type NotificationMessageInput = Pick<NotificationJobData, "type" | "metadata" | "resourceId"> & {
  appUrl: string;
  orgName: string;
};

export type NotificationEmailMessage = {
  subject: string;
  text: string;
};

export function buildNotificationEmailMessage({
  type,
  metadata = {},
  resourceId,
  appUrl,
  orgName,
}: NotificationMessageInput): NotificationEmailMessage {
  const orgPrefix = `[MetricOra] ${orgName}`;

  if (type === "report_ready") {
    const orgId = stringValue(metadata.orgId);
    const reportId = stringValue(metadata.reportId) ?? resourceId;
    const reportType = stringValue(metadata.reportType) ?? "report";
    const periodLabel = stringValue(metadata.reportingPeriodLabel) ?? "the selected reporting period";
    const url = orgId ? `${appUrl}/orgs/${orgId}/reports` : appUrl;
    return {
      subject: `${orgPrefix}: ${reportType.replaceAll("_", " ")} report is ready`,
      text: [
        `Your MetricOra report for ${periodLabel} is ready.`,
        `Report ID: ${reportId}`,
        `Open reports: ${url}`,
      ].join("\n"),
    };
  }

  if (type === "import_failed") {
    const orgId = stringValue(metadata.orgId);
    const filename = stringValue(metadata.sourceFilename) ?? "an import batch";
    const url = orgId ? `${appUrl}/orgs/${orgId}/imports` : appUrl;
    const error = stringValue(metadata.error) ?? "Import processing failed.";
    return {
      subject: `${orgPrefix}: import needs attention`,
      text: [
        `MetricOra could not process ${filename}.`,
        `Import ID: ${resourceId}`,
        `Reason: ${error}`,
        `Review imports: ${url}`,
      ].join("\n"),
    };
  }

  if (type === "submission_reviewed") {
    const orgId = stringValue(metadata.orgId);
    const status = stringValue(metadata.status) ?? "reviewed";
    const url = orgId ? `${appUrl}/orgs/${orgId}/submissions` : appUrl;
    return {
      subject: `${orgPrefix}: field submission ${status.replaceAll("_", " ")}`,
      text: [
        `Your field submission has been marked ${status.replaceAll("_", " ")}.`,
        `Submission ID: ${resourceId}`,
        `Review queue: ${url}`,
      ].join("\n"),
    };
  }

  const orgId = stringValue(metadata.orgId);
  const targetType = stringValue(metadata.targetType) ?? "resource";
  const targetLabel = stringValue(metadata.targetLabel) ?? resourceId;
  const targetDetail = stringValue(metadata.targetDetail);
  const targetHref = stringValue(metadata.targetHref);
  const url = targetHref ? `${appUrl}${targetHref}` : orgId ? `${appUrl}/orgs/${orgId}/dashboard` : appUrl;
  return {
    subject: `${orgPrefix}: task assigned`,
    text: [
      `A MetricOra ${targetType.replaceAll("_", " ")} review task has been assigned to you.`,
      `Target: ${targetLabel}`,
      targetDetail ? `Detail: ${targetDetail}` : undefined,
      `Task ID: ${resourceId}`,
      `Open task: ${url}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
