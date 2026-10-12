export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { sendEmail, subcontractorRequestEmail } from "@/lib/notifications/email";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import {
  OPEN_STATUSES, issueLinkSchema, issueLinkToken, orgSubmissionView, portalUrl,
} from "@/lib/subcontractor/portal";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; contractId: string; submissionId: string }> };

/**
 * Issues a new link for a subcontractor submission. Emailed to the contact, or
 * returned once for the team to copy. Only the token's hash is stored, so a lost
 * link is replaced by issuing another, which invalidates the old one.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, submissionId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.contractManagers);

    const limited = await rateLimitRequest(req, {
      key: `subcontractor-link:${submissionId}`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (limited) return limited;

    const existing = await prisma.subcontractorCarbonSubmission.findFirst({
      where: { id: submissionId, contractId, organizationId: orgId },
      include: { organization: { select: { name: true } } },
    });
    if (!existing) return apiError("NOT_FOUND", "Subcontractor submission not found.", 404);
    if (!OPEN_STATUSES.includes(existing.status)) {
      return apiError("INVALID_STATUS", `Cannot send a link for a submission with status "${existing.status}".`, 422);
    }

    const body = await req.json().catch(() => null);
    const parsed = issueLinkSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Choose how to send the link.", 400, parsed.error.flatten());
    }
    const { delivery } = parsed.data;

    const contactEmail = existing.contactEmail;
    if (delivery === "email" && !contactEmail) {
      return apiError(
        "MISSING_CONTACT_EMAIL",
        "This request has no contact email. Use Copy link, or add the email when you request the submission.",
        422,
      );
    }

    const now = new Date();
    const issued = issueLinkToken(now);
    const url = portalUrl(issued.token);

    // Send before storing: if the email fails, the stored hash does not claim a link went out.
    if (delivery === "email" && contactEmail) {
      try {
        await sendEmail({
          to: contactEmail,
          ...subcontractorRequestEmail({
            recipientName: existing.subcontractorName,
            orgName: existing.organization.name,
            reportingPeriodLabel: existing.reportingPeriodLabel,
            dueDate: existing.dueDate,
            portalUrl: url,
            linkExpiresAt: issued.tokenExpiresAt,
          }),
        });
      } catch {
        return apiError("EMAIL_FAILED", "The email could not be sent. Try again, or use Copy link.", 502);
      }
    }

    const submission = await prisma.subcontractorCarbonSubmission.update({
      where: { id: submissionId },
      data: { tokenHash: issued.tokenHash, tokenExpiresAt: issued.tokenExpiresAt, linkSentAt: now },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "subcontractor_submission.link_issued",
      resourceType: "SubcontractorCarbonSubmission",
      resourceId: submissionId,
      metadata: { delivery, linkExpiresAt: issued.tokenExpiresAt.toISOString() },
    });

    const linkExpiresAt = issued.tokenExpiresAt.toISOString();
    const view = orgSubmissionView(submission);
    if (delivery === "copy") {
      // The only time the link leaves the server in plain form.
      return NextResponse.json({ submission: view, url, linkExpiresAt });
    }
    return NextResponse.json({ submission: view, linkExpiresAt });
  } catch (err) {
    return handleRouteError(err);
  }
}
