import { sendEmail, OrgBranding } from "@/lib/notifications/email";

const BRAND_GREEN = "#16a34a";
const BRAND_DARK = "#0f172a";
const TEXT_MUTED = "#64748b";
const TEXT_SUBTLE = "#94a3b8";
const BORDER = "#e2e8f0";
const BODY_BG = "#f1f5f9";

function btn(label: string, href: string, color = BRAND_GREEN): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;line-height:1;">${label}</a>`;
}

function kv(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 24px 10px 0;font-size:13px;color:${TEXT_SUBTLE};font-weight:500;white-space:nowrap;vertical-align:top;border-bottom:1px solid ${BORDER};">${label}</td>
    <td style="padding:10px 0;font-size:13px;font-weight:600;color:${BRAND_DARK};vertical-align:top;border-bottom:1px solid ${BORDER};">${value}</td>
  </tr>`;
}

function buildBrandedLayout(bodyHtml: string, branding?: OrgBranding): string {
  const hasOrgLogo = Boolean(branding?.orgLogoUrl);
  const hasOrgName = Boolean(branding?.orgName);
  const CARD_BG = "#ffffff";

  const headerContent = hasOrgLogo
    ? `<table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:30px;height:30px;background:${BRAND_GREEN};border-radius:7px;text-align:center;vertical-align:middle;">
                <span style="color:#fff;font-size:16px;font-weight:800;line-height:30px;display:inline-block;width:30px;text-align:center;">M</span>
              </td>
              <td style="padding-left:9px;font-size:16px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.01em;vertical-align:middle;">MetricOra</td>
            </tr></table>
          </td>
          <td style="vertical-align:middle;text-align:right;">
            <img src="${branding!.orgLogoUrl}" alt="${branding!.orgName ?? "Organisation"}" height="32" style="display:inline-block;max-width:140px;max-height:32px;object-fit:contain;vertical-align:middle;">
          </td>
        </tr>
      </table>`
    : `<table cellpadding="0" cellspacing="0"><tr>
        <td style="width:32px;height:32px;background:${BRAND_GREEN};border-radius:8px;text-align:center;vertical-align:middle;">
          <span style="color:#fff;font-size:18px;font-weight:800;line-height:32px;display:inline-block;width:32px;text-align:center;">M</span>
        </td>
        <td style="padding-left:10px;font-size:18px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.01em;vertical-align:middle;">MetricOra</td>
      </tr></table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MetricOra</title>
</head>
<body style="margin:0;padding:0;background:${BODY_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BODY_BG};padding:36px 16px 40px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="background:${CARD_BG};border-radius:12px;border:1px solid ${BORDER};overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:20px 32px;border-bottom:1px solid ${BORDER};">
            ${headerContent}
          </td></tr>
          <tr><td style="padding:36px 32px 32px;">
            ${bodyHtml}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding-top:24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:${TEXT_SUBTLE};line-height:1.6;">
          MetricOra - GHG emissions tracking for growing businesses
        </p>
        <a href="https://www.metricora.co.uk" style="font-size:12px;color:${TEXT_MUTED};text-decoration:none;">www.metricora.co.uk</a>
        ${hasOrgName ? `<span style="color:${BORDER};padding:0 8px;">|</span><span style="font-size:12px;color:${TEXT_SUBTLE};">Sent on behalf of ${branding!.orgName}</span>` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export async function sendSupplierCredentialsEmail(params: {
  supplierEmail: string;
  temporaryPassword: string;
  loginUrl: string;
  invitedByName: string;
  organizationName: string;
  companyName?: string | null;
  orgLogoUrl?: string | null;
}) {
  const { supplierEmail, temporaryPassword, loginUrl, invitedByName, organizationName, companyName, orgLogoUrl } = params;

  const branding: OrgBranding = { orgName: organizationName, orgLogoUrl: orgLogoUrl ?? null };
  const greeting = companyName ? `Hi ${companyName},` : "Hi there,";

  const html = buildBrandedLayout(`
    <p style="margin:0 0 8px;">
      <span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:11px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;padding:3px 10px;border-radius:20px;">Account ready</span>
    </p>
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;line-height:1.3;">
      Your MetricOra account is ready
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.6;">
      ${greeting}<br>
      <strong style="color:${BRAND_DARK};font-weight:600;">${invitedByName}</strong> from <strong style="color:${BRAND_DARK};font-weight:600;">${organizationName}</strong> has set up a MetricOra account for you. Use the credentials below to log in and submit your emissions data.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px;">
      <tbody>
        ${kv("Email", supplierEmail)}
        ${kv("Temporary password", `<code style="font-family:monospace;background:#f1f5f9;padding:2px 6px;border-radius:4px;">${temporaryPassword}</code>`)}
      </tbody>
    </table>
    <p style="margin:0 0 24px;font-size:13px;color:#dc2626;font-weight:500;">
      You will be prompted to change your password on first login.
    </p>
    ${btn("Log in to MetricOra", loginUrl)}
  `, branding);

  const text = [
    `Hi ${companyName || "there"},`,
    ``,
    `${invitedByName} from ${organizationName} has set up a MetricOra account for you.`,
    ``,
    `Email: ${supplierEmail}`,
    `Temporary password: ${temporaryPassword}`,
    ``,
    `You will be prompted to change your password on first login.`,
    ``,
    `Log in: ${loginUrl}`,
  ].join("\n");

  await sendEmail({ to: supplierEmail, subject: `Your MetricOra account from ${organizationName}`, html, text });
}

export async function sendSupplierInviteEmail(params: {
  supplierEmail: string;
  inviteUrl: string;
  invitedByName: string;
  organizationName: string;
  companyName?: string | null;
  orgLogoUrl?: string | null;
}) {
  const { supplierEmail, inviteUrl, invitedByName, organizationName, companyName, orgLogoUrl } = params;

  const branding: OrgBranding = { orgName: organizationName, orgLogoUrl: orgLogoUrl ?? null };
  const greeting = companyName ? `Hi ${companyName},` : "Hi there,";

  const html = buildBrandedLayout(`
    <p style="margin:0 0 8px;">
      <span style="display:inline-block;background:#f0fdf4;color:#15803d;font-size:11px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;padding:3px 10px;border-radius:20px;">Invitation</span>
    </p>
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;line-height:1.3;">
      You're invited to MetricOra
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.6;">
      ${greeting}<br>
      <strong style="color:${BRAND_DARK};font-weight:600;">${invitedByName}</strong> from <strong style="color:${BRAND_DARK};font-weight:600;">${organizationName}</strong> has invited you to join their carbon emissions tracking platform on MetricOra.
    </p>
    ${btn("Accept invitation", inviteUrl)}
    <p style="margin:24px 0 0;font-size:12px;color:${TEXT_SUBTLE};line-height:1.6;">
      Or copy this link into your browser:<br>
      <span style="font-family:monospace;font-size:11px;color:${TEXT_MUTED};word-break:break-all;">${inviteUrl}</span>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:${TEXT_SUBTLE};line-height:1.6;">
      This invitation expires in 7 days. If you were not expecting this, you can safely ignore this email.
    </p>
  `, branding);

  const text = [
    `Hi ${companyName || "there"},`,
    ``,
    `${invitedByName} from ${organizationName} has invited you to join MetricOra.`,
    ``,
    `Accept your invitation: ${inviteUrl}`,
    ``,
    `This invitation expires in 7 days. If you were not expecting this, you can safely ignore this email.`,
  ].join("\n");

  await sendEmail({ to: supplierEmail, subject: `${organizationName} invites you to MetricOra`, html, text });
}

export async function sendSupplierDataRequestEmail(params: {
  supplierEmail: string;
  submissionUrl: string;
  organizationName: string;
  emissionCategory: string;
  reportingYear: number;
  orgLogoUrl?: string | null;
}) {
  const { supplierEmail, submissionUrl, organizationName, emissionCategory, reportingYear, orgLogoUrl } = params;

  const branding: OrgBranding = { orgName: organizationName, orgLogoUrl: orgLogoUrl ?? null };

  const html = buildBrandedLayout(`
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.02em;line-height:1.3;">
      Data request from ${organizationName}
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:${TEXT_MUTED};line-height:1.6;">
      <strong style="color:${BRAND_DARK};font-weight:600;">${organizationName}</strong> is requesting emissions data from you for their ${reportingYear} sustainability report. The form takes about 5 minutes.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px;">
      <tbody>
        ${kv("Category", emissionCategory)}
        ${kv("Reporting year", String(reportingYear))}
      </tbody>
    </table>
    ${btn("Submit data", submissionUrl)}
    <p style="margin:20px 0 0;font-size:12px;color:${TEXT_MUTED};line-height:1.6;">
      Your submission will be kept confidential and used only for emissions reporting purposes.<br>
      Reply to this email if you have questions.
    </p>
  `, branding);

  const text = [
    `Hi there,`,
    ``,
    `${organizationName} is requesting emissions data for their ${reportingYear} sustainability report.`,
    ``,
    `Category: ${emissionCategory}`,
    ``,
    `Submit your data: ${submissionUrl}`,
    ``,
    `Your submission will be kept confidential and used only for emissions reporting purposes.`,
  ].join("\n");

  await sendEmail({
    to: supplierEmail,
    subject: `Data request: ${emissionCategory} (${reportingYear})`,
    html,
    text,
  });
}
