// Email sending — RESEND_API_KEY in prod, console log in dev (EMAIL_DRIVER=console)

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
      console.warn("[email] RESEND_API_KEY not set — email skipped:", { to: payload.to, subject: payload.subject });
    } else {
      console.log("[email:console]", { to: payload.to, subject: payload.subject });
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
    console.log("[email] Would send:", { to: payload.to, subject: payload.subject });
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
