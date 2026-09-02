import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSupplierCredentialsEmail(params: {
  supplierEmail: string;
  temporaryPassword: string;
  loginUrl: string;
  invitedByName: string;
  organizationName: string;
  companyName?: string | null;
}) {
  const { supplierEmail, temporaryPassword, loginUrl, invitedByName, organizationName, companyName } = params;

  if (!process.env.RESEND_API_KEY) {
    console.log("[SupplierInvite] Email disabled (RESEND_API_KEY not set)");
    return;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #333; margin: 0;">Your CarbonSite Account is Ready</h1>
      </div>

      <p style="font-size: 16px; color: #666; line-height: 1.6;">
        Hi ${companyName || "there"},
      </p>

      <p style="font-size: 16px; color: #666; line-height: 1.6;">
        <strong>${invitedByName}</strong> from <strong>${organizationName}</strong> has set up a CarbonSite account for you.
        Use the credentials below to log in and submit your emissions data.
      </p>

      <div style="background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #444;"><strong>Email:</strong> ${supplierEmail}</p>
        <p style="margin: 0; font-size: 14px; color: #444;"><strong>Temporary Password:</strong>
          <code style="background-color: #e8e8e8; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${temporaryPassword}</code>
        </p>
      </div>

      <p style="font-size: 14px; color: #e53e3e; font-weight: 500;">
        You will be prompted to change your password on first login.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" style="
          display: inline-block;
          background-color: #3b82f6;
          color: white;
          padding: 12px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          font-size: 16px;
        ">
          Log In to CarbonSite
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;" />

      <p style="font-size: 12px; color: #999;">
        CarbonSite helps organizations track, report, and reduce their carbon emissions.
        <br/>
        <a href="https://carbonsite.ai" style="color: #3b82f6; text-decoration: none;">Learn more</a>
      </p>
    </div>
  `;

  try {
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@carbonsite.ai",
      to: supplierEmail,
      subject: `Your CarbonSite account from ${organizationName}`,
      html: htmlContent,
    });

    console.log(`[SupplierInvite] Credentials email sent to ${supplierEmail}:`, response);
    return response;
  } catch (error) {
    console.error(`[SupplierInvite] Failed to send credentials email to ${supplierEmail}:`, error);
    throw error;
  }
}

export async function sendSupplierInviteEmail(params: {
  supplierEmail: string;
  inviteUrl: string;
  invitedByName: string;
  organizationName: string;
  companyName?: string | null;
}) {
  const { supplierEmail, inviteUrl, invitedByName, organizationName, companyName } = params;

  if (!process.env.RESEND_API_KEY) {
    console.log("[SupplierInvite] Email disabled (RESEND_API_KEY not set)");
    return;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #333; margin: 0;">You're Invited to CarbonSite</h1>
      </div>

      <p style="font-size: 16px; color: #666; line-height: 1.6;">
        Hi ${companyName || "there"},
      </p>

      <p style="font-size: 16px; color: #666; line-height: 1.6;">
        <strong>${invitedByName}</strong> from <strong>${organizationName}</strong> has invited you to join their
        carbon emissions tracking and reporting platform on CarbonSite.
      </p>

      <p style="font-size: 16px; color: #666; line-height: 1.6;">
        You'll be able to:
      </p>

      <ul style="font-size: 16px; color: #666; line-height: 1.8;">
        <li>Submit your company's emissions data directly</li>
        <li>Track submission status in real-time</li>
        <li>Upload supporting documents and calculations</li>
        <li>Collaborate with ${organizationName} on data verification</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" style="
          display: inline-block;
          background-color: #3b82f6;
          color: white;
          padding: 12px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          font-size: 16px;
        ">
          Accept Invitation
        </a>
      </div>

      <p style="font-size: 14px; color: #999; line-height: 1.6;">
        Or copy and paste this link into your browser:
        <br/>
        <code style="background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px;">
          ${inviteUrl}
        </code>
      </p>

      <p style="font-size: 14px; color: #999; line-height: 1.6;">
        This invitation expires in 7 days.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;" />

      <p style="font-size: 12px; color: #999;">
        CarbonSite helps organizations track, report, and reduce their carbon emissions.
        <br/>
        <a href="https://carbonsite.ai" style="color: #3b82f6; text-decoration: none;">Learn more</a>
      </p>
    </div>
  `;

  try {
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@carbonsite.ai",
      to: supplierEmail,
      subject: `${organizationName} invites you to CarbonSite`,
      html: htmlContent,
    });

    console.log(`[SupplierInvite] Email sent to ${supplierEmail}:`, response);
    return response;
  } catch (error) {
    console.error(`[SupplierInvite] Failed to send email to ${supplierEmail}:`, error);
    throw error;
  }
}

export async function sendSupplierDataRequestEmail(params: {
  supplierEmail: string;
  submissionUrl: string;
  organizationName: string;
  emissionCategory: string;
  reportingYear: number;
}) {
  const { supplierEmail, submissionUrl, organizationName, emissionCategory, reportingYear } = params;

  if (!process.env.RESEND_API_KEY) {
    console.log("[SupplierDataRequest] Email disabled (RESEND_API_KEY not set)");
    return;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #333; margin: 0;">Data Request from ${organizationName}</h1>
      </div>

      <p style="font-size: 16px; color: #666; line-height: 1.6;">
        Hi there,
      </p>

      <p style="font-size: 16px; color: #666; line-height: 1.6;">
        <strong>${organizationName}</strong> is requesting emissions data from you for their ${reportingYear} sustainability report.
      </p>

      <p style="font-size: 16px; color: #666; line-height: 1.6;">
        <strong>What we need:</strong> ${emissionCategory}
      </p>

      <p style="font-size: 16px; color: #666; line-height: 1.6;">
        Please submit the requested data using the form below. It should only take a few minutes.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${submissionUrl}" style="
          display: inline-block;
          background-color: #10b981;
          color: white;
          padding: 12px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          font-size: 16px;
        ">
          Submit Data
        </a>
      </div>

      <p style="font-size: 14px; color: #999; line-height: 1.6;">
        Your submission will be kept confidential and used only for emissions reporting purposes.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;" />

      <p style="font-size: 12px; color: #999;">
        Questions? Contact ${organizationName} directly or reply to this email.
      </p>
    </div>
  `;

  try {
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@carbonsite.ai",
      to: supplierEmail,
      subject: `Data Request: ${emissionCategory} (${reportingYear})`,
      html: htmlContent,
    });

    console.log(`[SupplierDataRequest] Email sent to ${supplierEmail}:`, response);
    return response;
  } catch (error) {
    console.error(`[SupplierDataRequest] Failed to send email to ${supplierEmail}:`, error);
    throw error;
  }
}
