// Email sending — RESEND_API_KEY in prod, console log in dev (EMAIL_DRIVER=console)

import { notificationLogger } from "@/lib/logger";

const DRIVER = process.env.EMAIL_DRIVER ?? (process.env.RESEND_API_KEY ? "resend" : "console");
const FROM = process.env.EMAIL_FROM ?? "CarbonSite <noreply@carbonsite.app>";

export type TransactionalEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type TransactionalEmailResult = {
  provider: string;
  messageId: string | null;
};

export async function sendTransactionalEmail(
  payload: TransactionalEmailPayload,
): Promise<TransactionalEmailResult> {
  if (DRIVER === "console") {
    if (process.env.NODE_ENV === "production") {
      notificationLogger.warn(
        "Email sending skipped — RESEND_API_KEY not configured",
        { to: payload.to, subject: payload.subject },
      );
    } else {
      notificationLogger.debug(
        "Email sent via console driver",
        { to: payload.to, subject: payload.subject },
      );
    }
    return { provider: "console", messageId: null };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY!);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html ?? `<pre>${payload.text}</pre>`,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return { provider: "resend", messageId: data?.id ?? null };
}

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (DRIVER === "console") {
    notificationLogger.debug("Email sent via console driver", { to: payload.to, subject: payload.subject });
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY!);

  const { error } = await resend.emails.send({
    from: FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

// ── Email templates (minimal, no external template engine needed) ─────────────

export function taskAssignedEmail(params: {
  recipientName: string;
  orgName: string;
  taskType: string;
  targetLabel: string;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Action required: ${params.taskType} review task assigned`;
  const text = `Hi ${params.recipientName},\n\nA review task has been assigned to you in ${params.orgName}.\n\nTask: ${params.targetLabel}\n\nOpen in CarbonSite: ${params.appUrl}\n\nThe CarbonSite team`;
  const html = `<p>Hi ${params.recipientName},</p><p>A review task has been assigned to you in <strong>${params.orgName}</strong>.</p><p><strong>Task:</strong> ${params.targetLabel}</p><p><a href="${params.appUrl}">Open in CarbonSite</a></p>`;
  return { subject, html, text };
}

export function submissionReceivedEmail(params: {
  recipientName: string;
  orgName: string;
  submitterLabel: string;
  documentLabel: string;
  siteLabel: string | null;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const siteSuffix = params.siteLabel ? ` at ${params.siteLabel}` : "";
  const subject = `New field submission awaiting review — ${params.orgName}`;
  const text = `Hi ${params.recipientName},\n\n${params.submitterLabel} submitted a ${params.documentLabel}${siteSuffix} for review in ${params.orgName}.\n\nReview it in CarbonSite: ${params.appUrl}`;
  const html = `<p>Hi ${params.recipientName},</p><p><strong>${params.submitterLabel}</strong> submitted a ${params.documentLabel}${siteSuffix} for review in <strong>${params.orgName}</strong>.</p><p><a href="${params.appUrl}">Review it in CarbonSite</a></p>`;
  return { subject, html, text };
}

export function importFailedEmail(params: {
  recipientName: string;
  orgName: string;
  filename: string;
  errorCount: number;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Import needs attention: ${params.filename}`;
  const text = `Hi ${params.recipientName},\n\nYour import "${params.filename}" in ${params.orgName} has ${params.errorCount} validation error(s) that need attention.\n\nOpen in CarbonSite: ${params.appUrl}`;
  const html = `<p>Hi ${params.recipientName},</p><p>Your import <strong>${params.filename}</strong> in <strong>${params.orgName}</strong> has <strong>${params.errorCount}</strong> validation error(s) that need attention.</p><p><a href="${params.appUrl}">Review errors in CarbonSite</a></p>`;
  return { subject, html, text };
}

export function reportReadyEmail(params: {
  recipientName: string;
  orgName: string;
  reportLabel: string;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Report ready: ${params.reportLabel}`;
  const text = `Hi ${params.recipientName},\n\nYour report "${params.reportLabel}" in ${params.orgName} is ready to download.\n\nOpen in CarbonSite: ${params.appUrl}`;
  const html = `<p>Hi ${params.recipientName},</p><p>Your report <strong>${params.reportLabel}</strong> in <strong>${params.orgName}</strong> is ready to download.</p><p><a href="${params.appUrl}">Download in CarbonSite</a></p>`;
  return { subject, html, text };
}

export function submissionReviewedEmail(params: {
  recipientName: string;
  orgName: string;
  status: string;
  reviewNote?: string;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const statusLabel = params.status === "approved" ? "approved" : params.status === "rejected" ? "rejected" : "needs more info";
  const subject = `Your submission was ${statusLabel}`;
  const noteHtml = params.reviewNote ? `<p><strong>Reviewer note:</strong> ${params.reviewNote}</p>` : "";
  const noteText = params.reviewNote ? `\n\nReviewer note: ${params.reviewNote}` : "";
  const text = `Hi ${params.recipientName},\n\nYour submission in ${params.orgName} was ${statusLabel}.${noteText}\n\nOpen in CarbonSite: ${params.appUrl}`;
  const html = `<p>Hi ${params.recipientName},</p><p>Your submission in <strong>${params.orgName}</strong> was <strong>${statusLabel}</strong>.</p>${noteHtml}<p><a href="${params.appUrl}">View in CarbonSite</a></p>`;
  return { subject, html, text };
}

export function supplierDataRequestEmail(params: {
  recipientName: string;
  orgName: string;
  categoryName: string;
  periodLabel: string;
  formUrl: string;
  expiresAt: Date;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const expires = params.expiresAt.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const subject = `${params.orgName} is requesting your emissions data`;
  const text = [
    `Hi ${params.recipientName},`,
    ``,
    `${params.orgName} is asking you to provide emissions data for the following:`,
    ``,
    `  Category: ${params.categoryName}`,
    `  Reporting period: ${params.periodLabel}`,
    ``,
    `Please complete the short data form by ${expires}:`,
    `${params.formUrl}`,
    ``,
    `The form takes about 5 minutes. You will need:`,
    `  - Annual spend or activity quantity for the above category`,
    `  - Your preferred unit (kg, tonnes, litres, kWh, or £ spend)`,
    ``,
    `If you have questions, reply to this email.`,
    ``,
    `Thank you,`,
    `The CarbonSite team on behalf of ${params.orgName}`,
  ].join("\n");

  const html = `
<p>Hi ${params.recipientName},</p>
<p><strong>${params.orgName}</strong> is requesting your emissions data to support their GHG inventory.</p>
<table style="border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-size:14px;">Category</td><td style="padding:4px 0;font-weight:600;">${params.categoryName}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-size:14px;">Reporting period</td><td style="padding:4px 0;font-weight:600;">${params.periodLabel}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-size:14px;">Deadline</td><td style="padding:4px 0;font-weight:600;">${expires}</td></tr>
</table>
<p>
  <a href="${params.formUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
    Complete data form (5 min)
  </a>
</p>
<p style="color:#6b7280;font-size:13px;">You will need: annual spend or activity quantity, preferred unit (kg / tonnes / kWh / £).</p>
<p style="color:#6b7280;font-size:13px;">Reply to this email if you have questions.</p>
`;

  return { subject, html, text };
}

export function supplierDataApprovedEmail(params: {
  recipientName: string;
  orgName: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Your emissions data submission was approved`;
  const text = `Hi ${params.recipientName},\n\nYour emissions data submission for ${params.orgName} was approved.\n\nThank you!`;
  const html = `<p>Hi ${params.recipientName},</p><p>Your emissions data submission for <strong>${params.orgName}</strong> was approved.</p><p>Thank you!</p>`;
  return { subject, html, text };
}

export function supplierDataRejectedEmail(params: {
  recipientName: string;
  orgName: string;
  reason?: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Your emissions data submission needs revision`;
  const reasonText = params.reason ? `\n\nReason: ${params.reason}` : "";
  const reasonHtml = params.reason ? `<p><strong>Reason:</strong> ${params.reason}</p>` : "";
  const text = `Hi ${params.recipientName},\n\nYour emissions data submission for ${params.orgName} needs revision.${reasonText}`;
  const html = `<p>Hi ${params.recipientName},</p><p>Your emissions data submission for <strong>${params.orgName}</strong> needs revision.</p>${reasonHtml}`;
  return { subject, html, text };
}

export function supplierDataFlaggedEmail(params: {
  recipientName: string;
  orgName: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Your emissions data submission is under review`;
  const text = `Hi ${params.recipientName},\n\nYour emissions data submission for ${params.orgName} is currently under review by our team.`;
  const html = `<p>Hi ${params.recipientName},</p><p>Your emissions data submission for <strong>${params.orgName}</strong> is currently under review by our team.</p>`;
  return { subject, html, text };
}
