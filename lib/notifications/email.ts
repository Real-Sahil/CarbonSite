// Email sending — RESEND_API_KEY in prod, SMTP via nodemailer, or console log in dev
// EMAIL_DRIVER=smtp | resend | console (auto-detected when not set)

import { notificationLogger } from "@/lib/logger";

const DRIVER =
  process.env.EMAIL_DRIVER ??
  (process.env.RESEND_API_KEY ? "resend" : process.env.SMTP_HOST ? "smtp" : "console");
const FROM = process.env.EMAIL_FROM ?? "MetricOra <noreply@metricora.co.uk>";

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

  if (DRIVER === "smtp") {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    const info = await transporter.sendMail({
      from: FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html ?? `<pre>${payload.text}</pre>`,
    });
    return { provider: "smtp", messageId: info.messageId ?? null };
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

  if (DRIVER === "smtp") {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
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

// ── Branded email layout ──────────────────────────────────────────────────────

const BRAND_GREEN = "#16a34a";
const BRAND_DARK = "#0f172a";
const BODY_BG = "#f8fafc";
const CARD_BG = "#ffffff";
const TEXT_MUTED = "#64748b";
const BORDER = "#e2e8f0";

function btn(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_GREEN};color:#ffffff;padding:11px 26px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;">${label}</a>`;
}

function kv(label: string, value: string): string {
  return `<tr>
    <td style="padding:5px 20px 5px 0;font-size:13px;color:${TEXT_MUTED};white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:5px 0;font-size:13px;font-weight:600;color:${BRAND_DARK};vertical-align:top;">${value}</td>
  </tr>`;
}

function emailLayout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MetricOra</title>
</head>
<body style="margin:0;padding:0;background:${BODY_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BODY_BG};padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <!-- Header -->
      <tr><td style="padding-bottom:24px;" align="center">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:32px;height:32px;background:${BRAND_GREEN};border-radius:8px;text-align:center;vertical-align:middle;">
              <span style="color:#ffffff;font-size:18px;font-weight:800;line-height:32px;display:inline-block;width:32px;text-align:center;">M</span>
            </td>
            <td style="padding-left:10px;font-size:18px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.01em;vertical-align:middle;">MetricOra</td>
          </tr>
        </table>
      </td></tr>

      <!-- Card -->
      <tr><td style="background:${CARD_BG};border-radius:10px;border:1px solid ${BORDER};padding:36px 40px;">
        ${bodyHtml}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding-top:24px;text-align:center;font-size:12px;color:${TEXT_MUTED};line-height:1.6;">
        MetricOra &mdash; GHG emissions tracking for growing businesses<br>
        <a href="https://www.metricora.co.uk" style="color:${TEXT_MUTED};text-decoration:none;">www.metricora.co.uk</a>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Email templates ───────────────────────────────────────────────────────────

export function memberAccessGrantedEmail(params: {
  addedByName: string;
  orgName: string;
  role: string;
  dashboardUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const roleLabel = params.role.replaceAll("_", " ");
  const subject = `You've been added to ${params.orgName} on MetricOra`;
  const text = [
    `${params.addedByName} added you to ${params.orgName} on MetricOra.`,
    `Role: ${roleLabel}`,
    `Open workspace: ${params.dashboardUrl}`,
    ``,
    `If you did not expect this, you can safely ignore this email.`,
  ].join("\n");
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Access granted</p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      <strong style="color:${BRAND_DARK};">${params.addedByName}</strong> has added you to
      <strong style="color:${BRAND_DARK};">${params.orgName}</strong> on MetricOra.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:${BODY_BG};border-radius:6px;padding:16px 20px;width:100%;box-sizing:border-box;">
      <tbody>
        ${kv("Organisation", params.orgName)}
        ${kv("Your role", roleLabel)}
      </tbody>
    </table>
    ${btn("Open workspace", params.dashboardUrl)}
    <p style="margin:28px 0 0;font-size:12px;color:${TEXT_MUTED};line-height:1.6;">
      If you did not expect this invitation, you can safely ignore this email.
    </p>
  `);
  return { subject, html, text };
}

export function taskAssignedEmail(params: {
  recipientName: string;
  orgName: string;
  taskType: string;
  targetLabel: string;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Action required: ${params.taskType} review task assigned`;
  const text = `Hi ${params.recipientName},\n\nA review task has been assigned to you in ${params.orgName}.\n\nTask: ${params.targetLabel}\n\nOpen in MetricOra: ${params.appUrl}\n\nThe MetricOra team`;
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Review task assigned</p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, a review task has been assigned to you in
      <strong style="color:${BRAND_DARK};">${params.orgName}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:${BODY_BG};border-radius:6px;padding:16px 20px;width:100%;box-sizing:border-box;">
      <tbody>
        ${kv("Task type", params.taskType)}
        ${kv("Record", params.targetLabel)}
        ${kv("Organisation", params.orgName)}
      </tbody>
    </table>
    ${btn("Open task", params.appUrl)}
  `);
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
  const text = `Hi ${params.recipientName},\n\n${params.submitterLabel} submitted a ${params.documentLabel}${siteSuffix} for review in ${params.orgName}.\n\nReview it in MetricOra: ${params.appUrl}`;
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">New submission for review</p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, a new field submission is waiting for your review.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:${BODY_BG};border-radius:6px;padding:16px 20px;width:100%;box-sizing:border-box;">
      <tbody>
        ${kv("Submitted by", params.submitterLabel)}
        ${kv("Document type", params.documentLabel)}
        ${params.siteLabel ? kv("Site", params.siteLabel) : ""}
        ${kv("Organisation", params.orgName)}
      </tbody>
    </table>
    ${btn("Review submission", params.appUrl)}
  `);
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
  const text = `Hi ${params.recipientName},\n\nYour import "${params.filename}" in ${params.orgName} has ${params.errorCount} validation error(s) that need attention.\n\nOpen in MetricOra: ${params.appUrl}`;
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Import needs attention</p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, your import has validation errors that need resolving before it can be committed.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:${BODY_BG};border-radius:6px;padding:16px 20px;width:100%;box-sizing:border-box;">
      <tbody>
        ${kv("File", params.filename)}
        ${kv("Errors", String(params.errorCount))}
        ${kv("Organisation", params.orgName)}
      </tbody>
    </table>
    ${btn("Review errors", params.appUrl)}
  `);
  return { subject, html, text };
}

export function reportReadyEmail(params: {
  recipientName: string;
  orgName: string;
  reportLabel: string;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Report ready: ${params.reportLabel}`;
  const text = `Hi ${params.recipientName},\n\nYour report "${params.reportLabel}" in ${params.orgName} is ready to download.\n\nOpen in MetricOra: ${params.appUrl}`;
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Report ready</p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, your report is ready to download.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:${BODY_BG};border-radius:6px;padding:16px 20px;width:100%;box-sizing:border-box;">
      <tbody>
        ${kv("Report", params.reportLabel)}
        ${kv("Organisation", params.orgName)}
      </tbody>
    </table>
    ${btn("Download report", params.appUrl)}
  `);
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
  const statusColor = params.status === "approved" ? BRAND_GREEN : params.status === "rejected" ? "#dc2626" : "#d97706";
  const subject = `Your submission was ${statusLabel}`;
  const noteText = params.reviewNote ? `\n\nReviewer note: ${params.reviewNote}` : "";
  const text = `Hi ${params.recipientName},\n\nYour submission in ${params.orgName} was ${statusLabel}.${noteText}\n\nOpen in MetricOra: ${params.appUrl}`;
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Submission reviewed</p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, your submission in <strong style="color:${BRAND_DARK};">${params.orgName}</strong> has been reviewed.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:${BODY_BG};border-radius:6px;padding:16px 20px;width:100%;box-sizing:border-box;">
      <tbody>
        <tr>
          <td style="padding:5px 20px 5px 0;font-size:13px;color:${TEXT_MUTED};white-space:nowrap;vertical-align:top;">Status</td>
          <td style="padding:5px 0;font-size:13px;font-weight:600;color:${statusColor};vertical-align:top;text-transform:capitalize;">${statusLabel}</td>
        </tr>
        ${params.reviewNote ? kv("Reviewer note", params.reviewNote) : ""}
      </tbody>
    </table>
    ${btn("View submission", params.appUrl)}
  `);
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
    `The MetricOra team on behalf of ${params.orgName}`,
  ].join("\n");

  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Emissions data request</p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName},
      <strong style="color:${BRAND_DARK};">${params.orgName}</strong> is requesting your emissions data
      to support their GHG inventory. The form takes about 5 minutes.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:${BODY_BG};border-radius:6px;padding:16px 20px;width:100%;box-sizing:border-box;">
      <tbody>
        ${kv("Category", params.categoryName)}
        ${kv("Reporting period", params.periodLabel)}
        ${kv("Deadline", expires)}
      </tbody>
    </table>
    ${btn("Complete data form (5 min)", params.formUrl)}
    <p style="margin:20px 0 0;font-size:12px;color:${TEXT_MUTED};line-height:1.6;">
      You will need: annual spend or activity quantity, preferred unit (kg / tonnes / kWh / £).<br>
      Reply to this email if you have questions.
    </p>
  `);

  return { subject, html, text };
}

export function supplierDataApprovedEmail(params: {
  recipientName: string;
  orgName: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Your emissions data submission was approved`;
  const text = `Hi ${params.recipientName},\n\nYour emissions data submission for ${params.orgName} was approved.\n\nThank you!`;
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Submission approved</p>
    <p style="margin:0 0 0;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, your emissions data submission for
      <strong style="color:${BRAND_DARK};">${params.orgName}</strong> has been approved. Thank you for contributing to their GHG inventory.
    </p>
  `);
  return { subject, html, text };
}

export function supplierDataRejectedEmail(params: {
  recipientName: string;
  orgName: string;
  reason?: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Your emissions data submission needs revision`;
  const reasonText = params.reason ? `\n\nReason: ${params.reason}` : "";
  const text = `Hi ${params.recipientName},\n\nYour emissions data submission for ${params.orgName} needs revision.${reasonText}`;
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Submission needs revision</p>
    <p style="margin:0 0 ${params.reason ? "28px" : "0"};font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, your emissions data submission for
      <strong style="color:${BRAND_DARK};">${params.orgName}</strong> needs revision before it can be accepted.
    </p>
    ${params.reason ? `<table cellpadding="0" cellspacing="0" style="background:${BODY_BG};border-radius:6px;padding:16px 20px;width:100%;box-sizing:border-box;"><tbody>${kv("Reason", params.reason)}</tbody></table>` : ""}
  `);
  return { subject, html, text };
}

export function supplierDataFlaggedEmail(params: {
  recipientName: string;
  orgName: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Your emissions data submission is under review`;
  const text = `Hi ${params.recipientName},\n\nYour emissions data submission for ${params.orgName} is currently under review by our team.`;
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Submission under review</p>
    <p style="margin:0 0 0;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, your emissions data submission for
      <strong style="color:${BRAND_DARK};">${params.orgName}</strong> is currently under review. You will receive another email once a decision has been made.
    </p>
  `);
  return { subject, html, text };
}

export function supplierPasswordExpiringEmail(params: {
  recipientName: string;
  orgName: string;
  daysRemaining: number;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const days = `${params.daysRemaining} day${params.daysRemaining !== 1 ? "s" : ""}`;
  const subject = `Action required: your MetricOra password expires in ${days}`;
  const text = [
    `Hi ${params.recipientName},`,
    ``,
    `Your MetricOra password for ${params.orgName} will expire in ${days}.`,
    ``,
    `Please update your password before it expires to avoid losing access.`,
    ``,
    `Update your password: ${params.appUrl}`,
  ].join("\n");
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Password expiring soon</p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, your MetricOra password for
      <strong style="color:${BRAND_DARK};">${params.orgName}</strong> will expire in <strong style="color:#d97706;">${days}</strong>.
      Please update it before it expires to avoid losing access.
    </p>
    ${btn("Update password", params.appUrl)}
  `);
  return { subject, html, text };
}

export function supplierAccountTerminatedEmail(params: {
  recipientName: string;
  orgName: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Your MetricOra supplier account has been closed`;
  const text = `Hi ${params.recipientName},\n\nYour supplier account with ${params.orgName} on MetricOra has been closed. If you believe this is an error, please contact ${params.orgName} directly.`;
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Supplier account closed</p>
    <p style="margin:0 0 0;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, your supplier account with
      <strong style="color:${BRAND_DARK};">${params.orgName}</strong> on MetricOra has been closed.
      If you believe this is an error, please contact ${params.orgName} directly.
    </p>
  `);
  return { subject, html, text };
}

export function supplierAccountExpiringEmail(params: {
  recipientName: string;
  orgName: string;
  daysRemaining: number;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const days = `${params.daysRemaining} day${params.daysRemaining !== 1 ? "s" : ""}`;
  const subject = `Your MetricOra supplier access expires in ${days}`;
  const text = [
    `Hi ${params.recipientName},`,
    ``,
    `Your supplier access to ${params.orgName} on MetricOra will expire in ${days}.`,
    ``,
    `If you need continued access, please contact ${params.orgName} to renew your account.`,
    ``,
    `View your account: ${params.appUrl}`,
  ].join("\n");
  const html = emailLayout(`
    <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;">Supplier access expiring soon</p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">
      Hi ${params.recipientName}, your supplier access to
      <strong style="color:${BRAND_DARK};">${params.orgName}</strong> on MetricOra will expire in
      <strong style="color:#d97706;">${days}</strong>.
      Contact ${params.orgName} if you need continued access.
    </p>
    ${btn("View account", params.appUrl)}
  `);
  return { subject, html, text };
}

export function dsarSlaAlertEmail(params: {
  recipientName: string;
  orgName: string;
  subjectEmail: string;
  daysRemaining: number;
  requestId: string;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const urgency = params.daysRemaining <= 3 ? "URGENT: " : "";
  const subject = `${urgency}DSAR deadline approaching — ${params.daysRemaining} day${params.daysRemaining !== 1 ? "s" : ""} remaining`;
  const text = [
    `Hi ${params.recipientName},`,
    ``,
    `A Data Subject Access Request (DSAR) in ${params.orgName} is approaching its regulatory deadline.`,
    ``,
    `  Subject: ${params.subjectEmail}`,
    `  Days remaining: ${params.daysRemaining}`,
    `  Request ID: ${params.requestId}`,
    ``,
    `Please respond or escalate immediately to avoid non-compliance.`,
    ``,
    `Review the request: ${params.appUrl}`,
  ].join("\n");
  const html = `
<p>Hi ${params.recipientName},</p>
<p>A Data Subject Access Request (DSAR) in <strong>${params.orgName}</strong> is approaching its regulatory deadline.</p>
<table style="border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-size:14px;">Subject</td><td style="padding:4px 0;font-weight:600;">${params.subjectEmail}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-size:14px;">Days remaining</td><td style="padding:4px 0;font-weight:600;color:${params.daysRemaining <= 3 ? "#dc2626" : "#d97706"};">${params.daysRemaining}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-size:14px;">Request ID</td><td style="padding:4px 0;font-family:monospace;font-size:13px;">${params.requestId}</td></tr>
</table>
<p>Please respond or escalate immediately to avoid non-compliance.</p>
<p><a href="${params.appUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Review request</a></p>`;
  return { subject, html, text };
}

export function securityAlertEmail(params: {
  recipientName: string;
  orgName: string;
  alertType: string;
  detail: string;
  appUrl: string;
}): Pick<EmailPayload, "subject" | "html" | "text"> {
  const subject = `Security alert: ${params.alertType} — ${params.orgName}`;
  const text = [
    `Hi ${params.recipientName},`,
    ``,
    `A security event was detected in your MetricOra organisation (${params.orgName}).`,
    ``,
    `  Type: ${params.alertType}`,
    `  Detail: ${params.detail}`,
    ``,
    `If this was not you, please secure your account immediately.`,
    ``,
    `Review security logs: ${params.appUrl}`,
  ].join("\n");
  const html = `<p>Hi ${params.recipientName},</p><p>A security event was detected in your MetricOra organisation <strong>${params.orgName}</strong>.</p><p><strong>Type:</strong> ${params.alertType}<br><strong>Detail:</strong> ${params.detail}</p><p>If this was not you, please secure your account immediately.</p><p><a href="${params.appUrl}">Review security logs</a></p>`;
  return { subject, html, text };
}
