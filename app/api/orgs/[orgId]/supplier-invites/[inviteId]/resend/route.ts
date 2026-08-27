export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { supplierInviteEmail } from "@/lib/suppliers/email-templates";
import { CATEGORY_GUIDANCE } from "@/lib/suppliers/category-guidance";

// POST /api/orgs/[orgId]/supplier-invites/[inviteId]/resend — resend invite email (admin only)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> },
) {
  try {
    const { orgId, inviteId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const invite = await prisma.supplierInvite.findUnique({
      where: { id: inviteId },
      include: { organization: true },
    });

    if (!invite || invite.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Supplier invite not found.", 404);
    }

    if (invite.usedAt !== null) {
      return apiError(
        "INVITE_ALREADY_USED",
        "Cannot resend an invite that has already been accepted.",
        409,
      );
    }

    const now = new Date();
    if (invite.expiresAt < now) {
      return apiError(
        "INVITE_EXPIRED",
        "Invite has expired. Consider creating a new invite instead.",
        410,
      );
    }

    // Find associated data request to get category and period info
    const dataRequest = await prisma.supplierDataRequest.findFirst({
      where: {
        organizationId: orgId,
        supplierEmail: invite.email,
      },
      include: { reportingPeriod: true },
      orderBy: { createdAt: "desc" },
    });

    const categoryGuidance = dataRequest ? CATEGORY_GUIDANCE[dataRequest.categoryCode] : null;
    const categoryName = categoryGuidance?.categoryName || "Data Request";
    const periodLabel = dataRequest?.reportingPeriod.label || "2026";

    // Send the invite email
    const emailPayload = supplierInviteEmail({
      supplierEmail: invite.email,
      supplierName: invite.companyName || undefined,
      inviteToken: invite.token,
      categoryName,
      reportingPeriodLabel: periodLabel,
      orgName: invite.organization.name || "Organization",
    });

    const emailResult = await sendTransactionalEmail(emailPayload);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "supplier_data_request.resent",
      resourceType: "SupplierInvite",
      resourceId: inviteId,
      metadata: {
        email: invite.email,
        categoryName,
        periodLabel,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Invite resent to ${invite.email}`,
        messageId: emailResult.messageId,
      },
      { status: 200 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
