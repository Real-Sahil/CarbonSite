export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { resolveEmailLogoUrl } from "@/lib/notifications/email";
import { sendSupplierInviteEmail } from "@/workers/supplier-invite-email";
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

    // Fetch branding
    const branding = await prisma.tenantBranding.findUnique({
      where: { organizationId: orgId },
      select: { logoPublicUrl: true, reportHeaderLogoKey: true, logoStorageKey: true },
    });
    const orgLogoUrl = branding ? await resolveEmailLogoUrl(branding) : null;

    // Send the invite email with branding
    await sendSupplierInviteEmail({
      supplierEmail: invite.email,
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://metricora-rosy.vercel.app"}/supplier-invite/${invite.token}`,
      invitedByName: session.user.name || session.user.email || "A team member",
      organizationName: invite.organization.name || "MetricOra",
      companyName: invite.companyName,
      orgLogoUrl,
    });

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
      },
      { status: 200 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
