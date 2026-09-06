import { TransactionalEmailPayload } from "@/lib/notifications/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://metricora.co.uk";
const FROM_NAME = "MetricOra";

export type QualityFlag = {
  field: string;
  severity: "warning" | "critical";
  message: string;
  suggestedRange?: { min: number; max: number };
};

// ─── Supplier Invite Email ──────────────────────────────────────────────────
export function supplierInviteEmail(params: {
  supplierEmail: string;
  supplierName?: string;
  inviteToken: string;
  categoryName: string;
  reportingPeriodLabel: string;
  orgName: string;
}): TransactionalEmailPayload {
  const { supplierEmail, supplierName, inviteToken, categoryName, reportingPeriodLabel, orgName } = params;
  const acceptLink = `${APP_URL}/supplier-invite/${inviteToken}`;

  const greeting = supplierName ? `Hi ${supplierName},` : "Hi,";

  const text = `${greeting}

${orgName} is requesting your help with their emissions tracking and reporting.

They've asked you to provide data for the following:
• Category: ${categoryName}
• Period: ${reportingPeriodLabel}

To accept this request and view the details, click the link below:
${acceptLink}

This link expires in 30 days.

Once you accept, you'll be able to:
- View exactly what data is being requested
- Submit data directly through our secure portal
- Track the status of your submission
- Receive feedback on any issues

Questions? Contact ${orgName} directly.

Best regards,
${FROM_NAME}`;

  const html = `
<p>${greeting}</p>

<p><strong>${orgName}</strong> is requesting your help with their emissions tracking and reporting.</p>

<p>They've asked you to provide data for the following:</p>
<ul>
  <li><strong>Category:</strong> ${categoryName}</li>
  <li><strong>Period:</strong> ${reportingPeriodLabel}</li>
</ul>

<div style="margin: 24px 0; text-align: center;">
  <a href="${acceptLink}" style="background: linear-gradient(to right, #f97316, #fbbf24); color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">Accept Request</a>
</div>

<p>This link expires in 30 days.</p>

<p><strong>Once you accept, you'll be able to:</strong></p>
<ul>
  <li>View exactly what data is being requested</li>
  <li>Submit data directly through our secure portal</li>
  <li>Track the status of your submission</li>
  <li>Receive feedback on any issues</li>
</ul>

<p>Questions? Contact ${orgName} directly.</p>

<p>Best regards,<br>${FROM_NAME}</p>
  `.trim();

  return {
    to: supplierEmail,
    subject: `${orgName} is requesting your emissions data`,
    text,
    html,
  };
}

// ─── Data Submission Received Email ─────────────────────────────────────────
export function submissionReceivedEmail(params: {
  supplierEmail: string;
  supplierName?: string;
  categoryName: string;
  reportingPeriodLabel: string;
  orgName: string;
  portalLink: string;
}): TransactionalEmailPayload {
  const { supplierEmail, supplierName, categoryName, reportingPeriodLabel, orgName, portalLink } = params;

  const greeting = supplierName ? `Hi ${supplierName},` : "Hi,";

  const text = `${greeting}

Thank you for submitting your ${categoryName} data for the ${reportingPeriodLabel} period.

We've received your submission and our team is reviewing it. We'll let you know the outcome within 2 business days.

To check the status of your submission, visit your portal:
${portalLink}

Best regards,
${FROM_NAME}`;

  const html = `
<p>${greeting}</p>

<p>Thank you for submitting your <strong>${categoryName}</strong> data for the <strong>${reportingPeriodLabel}</strong> period.</p>

<p>We've received your submission and our team is reviewing it. We'll let you know the outcome within 2 business days.</p>

<div style="margin: 24px 0; text-align: center;">
  <a href="${portalLink}" style="background: linear-gradient(to right, #f97316, #fbbf24); color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">View Status</a>
</div>

<p>Best regards,<br>${FROM_NAME}</p>
  `.trim();

  return {
    to: supplierEmail,
    subject: `We've received your ${categoryName} data`,
    text,
    html,
  };
}

// ─── Submission Flagged (Quality Issues) Email ──────────────────────────────
export function submissionFlaggedEmail(params: {
  supplierEmail: string;
  supplierName?: string;
  categoryName: string;
  reportingPeriodLabel: string;
  qualityFlags: QualityFlag[];
  portalLink: string;
}): TransactionalEmailPayload {
  const { supplierEmail, supplierName, categoryName, reportingPeriodLabel, qualityFlags, portalLink } = params;

  const greeting = supplierName ? `Hi ${supplierName},` : "Hi,";

  const flagsText = qualityFlags
    .map((flag) => {
      const range = flag.suggestedRange
        ? ` (expected: ${flag.suggestedRange.min}–${flag.suggestedRange.max})`
        : "";
      return `• ${flag.field}: ${flag.message}${range}`;
    })
    .join("\n");

  const text = `${greeting}

We've reviewed your submission for ${categoryName} (${reportingPeriodLabel}), and we've found some data quality issues that need attention.

Issues found:
${flagsText}

These issues may indicate data entry errors or values outside the normal range. Please review your submission and resubmit with corrections if needed.

Visit your portal to view details and resubmit:
${portalLink}

If you're unsure about any of these flags, please contact the requesting organization directly for guidance.

Best regards,
${FROM_NAME}`;

  const flagsHtml = qualityFlags
    .map((flag) => {
      const severity = flag.severity === "critical" ? "🔴 Critical" : "🟡 Warning";
      const range = flag.suggestedRange
        ? `<br><small>Expected range: ${flag.suggestedRange.min}–${flag.suggestedRange.max}</small>`
        : "";
      return `<li><strong>${flag.field}</strong>: ${flag.message}${range}</li>`;
    })
    .join("");

  const html = `
<p>${greeting}</p>

<p>We've reviewed your submission for <strong>${categoryName}</strong> (<strong>${reportingPeriodLabel}</strong>), and we've found some data quality issues that need attention.</p>

<p><strong>Issues found:</strong></p>
<ul>${flagsHtml}</ul>

<p>These issues may indicate data entry errors or values outside the normal range. Please review your submission and resubmit with corrections if needed.</p>

<div style="margin: 24px 0; text-align: center;">
  <a href="${portalLink}" style="background: linear-gradient(to right, #f97316, #fbbf24); color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">Review & Resubmit</a>
</div>

<p>If you're unsure about any of these flags, please contact the requesting organization directly for guidance.</p>

<p>Best regards,<br>${FROM_NAME}</p>
  `.trim();

  return {
    to: supplierEmail,
    subject: `Review needed: ${categoryName} data has quality issues`,
    text,
    html,
  };
}

// ─── Submission Approved Email ──────────────────────────────────────────────
export function submissionApprovedEmail(params: {
  supplierEmail: string;
  supplierName?: string;
  categoryName: string;
  reportingPeriodLabel: string;
  orgName: string;
  portalLink: string;
}): TransactionalEmailPayload {
  const { supplierEmail, supplierName, categoryName, reportingPeriodLabel, orgName, portalLink } = params;

  const greeting = supplierName ? `Hi ${supplierName},` : "Hi,";

  const text = `${greeting}

Great news! Your ${categoryName} data for the ${reportingPeriodLabel} period has been approved.

Your data has been successfully integrated into ${orgName}'s emissions calculation and reporting.

Thank you for helping ${orgName} track and report their emissions accurately.

View your submission:
${portalLink}

Best regards,
${FROM_NAME}`;

  const html = `
<p>${greeting}</p>

<p><strong>Great news!</strong> Your <strong>${categoryName}</strong> data for the <strong>${reportingPeriodLabel}</strong> period has been approved.</p>

<p>Your data has been successfully integrated into <strong>${orgName}</strong>'s emissions calculation and reporting.</p>

<p>Thank you for helping ${orgName} track and report their emissions accurately.</p>

<div style="margin: 24px 0; text-align: center;">
  <a href="${portalLink}" style="background: linear-gradient(to right, #f97316, #fbbf24); color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">View Submission</a>
</div>

<p>Best regards,<br>${FROM_NAME}</p>
  `.trim();

  return {
    to: supplierEmail,
    subject: `✓ Your ${categoryName} data has been approved`,
    text,
    html,
  };
}

// ─── Submission Rejected Email ──────────────────────────────────────────────
export function submissionRejectedEmail(params: {
  supplierEmail: string;
  supplierName?: string;
  categoryName: string;
  reportingPeriodLabel: string;
  rejectionReason: string;
  portalLink: string;
}): TransactionalEmailPayload {
  const { supplierEmail, supplierName, categoryName, reportingPeriodLabel, rejectionReason, portalLink } = params;

  const greeting = supplierName ? `Hi ${supplierName},` : "Hi,";

  const text = `${greeting}

We've reviewed your ${categoryName} data for ${reportingPeriodLabel}, but we need you to revise it before we can approve it.

Reason for rejection:
${rejectionReason}

Please make the necessary corrections and resubmit. You can do this through your portal:
${portalLink}

If you have questions about this feedback, please contact the requesting organization directly.

Best regards,
${FROM_NAME}`;

  const html = `
<p>${greeting}</p>

<p>We've reviewed your <strong>${categoryName}</strong> data for <strong>${reportingPeriodLabel}</strong>, but we need you to revise it before we can approve it.</p>

<p><strong>Reason for rejection:</strong></p>
<blockquote style="border-left: 4px solid #f97316; padding-left: 16px; margin: 16px 0; color: #666;">
  ${rejectionReason}
</blockquote>

<p>Please make the necessary corrections and resubmit:</p>

<div style="margin: 24px 0; text-align: center;">
  <a href="${portalLink}" style="background: linear-gradient(to right, #f97316, #fbbf24); color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">Resubmit Data</a>
</div>

<p>If you have questions about this feedback, please contact the requesting organization directly.</p>

<p>Best regards,<br>${FROM_NAME}</p>
  `.trim();

  return {
    to: supplierEmail,
    subject: `Action needed: ${categoryName} data needs revision`,
    text,
    html,
  };
}

// ─── Supplier Credentials Email (Admin-created account) ──────────────────────
export function supplierCredentialsEmail(params: {
  supplierEmail: string;
  temporaryPassword: string;
  loginUrl: string;
  companyName?: string;
  organizationName: string;
  invitedByName: string;
}): TransactionalEmailPayload {
  const { supplierEmail, temporaryPassword, loginUrl, companyName, organizationName, invitedByName } = params;

  const supplierName = companyName || supplierEmail.split("@")[0];

  const text = `Hi ${supplierName},

${invitedByName} from ${organizationName} has created an account for you to submit and manage emissions data.

Account Details:
Email: ${supplierEmail}
Temporary Password: ${temporaryPassword}

To login and get started, visit:
${loginUrl}

When you first login, you'll be prompted to change your password.

Questions? Contact ${organizationName} directly.

Best regards,
MetricOra`;

  const html = `
<p>Hi ${supplierName},</p>

<p><strong>${invitedByName}</strong> from <strong>${organizationName}</strong> has created an account for you to submit and manage emissions data.</p>

<div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
  <p><strong>Account Details</strong></p>
  <p>
    <strong>Email:</strong> ${supplierEmail}<br>
    <strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">${temporaryPassword}</code>
  </p>
</div>

<p><strong>To login and get started:</strong></p>

<div style="margin: 24px 0; text-align: center;">
  <a href="${loginUrl}" style="background: linear-gradient(to right, #f97316, #fbbf24); color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">Login to Your Account</a>
</div>

<p><em>When you first login, you'll be prompted to change your temporary password.</em></p>

<p>Questions? Contact ${organizationName} directly.</p>

<p>Best regards,<br>MetricOra</p>
  `.trim();

  return {
    to: supplierEmail,
    subject: `Your ${organizationName} account is ready`,
    text,
    html,
  };
}

// ─── Invite Accepted (Admin Notification) Email ──────────────────────────────
export function inviteAcceptedEmail(params: {
  adminEmail: string;
  supplierName?: string;
  supplierEmail: string;
  categoryName: string;
  reportingPeriodLabel: string;
  dashboardLink: string;
}): TransactionalEmailPayload {
  const { adminEmail, supplierName, supplierEmail, categoryName, reportingPeriodLabel, dashboardLink } = params;

  const supplierDisplay = supplierName ? `${supplierName} (${supplierEmail})` : supplierEmail;

  const text = `Your supplier data request has been accepted.

Supplier: ${supplierDisplay}
Category: ${categoryName}
Period: ${reportingPeriodLabel}

The supplier will now be able to view the data form and submit their information.

View the request:
${dashboardLink}`;

  const html = `
<p><strong>Your supplier data request has been accepted.</strong></p>

<p>
  <strong>Supplier:</strong> ${supplierDisplay}<br>
  <strong>Category:</strong> ${categoryName}<br>
  <strong>Period:</strong> ${reportingPeriodLabel}
</p>

<p>The supplier will now be able to view the data form and submit their information.</p>

<div style="margin: 24px 0; text-align: center;">
  <a href="${dashboardLink}" style="background: linear-gradient(to right, #f97316, #fbbf24); color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">View Request</a>
</div>
  `.trim();

  return {
    to: adminEmail,
    subject: `Supplier has accepted data request: ${categoryName}`,
    text,
    html,
  };
}
