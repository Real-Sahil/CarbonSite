"use server";

import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { inviteAcceptedEmail } from "@/lib/suppliers/email-templates";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { CATEGORY_GUIDANCE } from "@/lib/suppliers/category-guidance";

export async function acceptSupplierInvite(
  _prevState: any,
  formData: FormData,
): Promise<{ success?: boolean; portalToken?: string; error?: string; details?: string }> {
  try {
    const token = formData.get("token") as string;
    const displayName = formData.get("displayName") as string;

    if (!token || !displayName) {
      return { error: "Missing required information", details: "Token and name are required" };
    }

    // Find the supplier invite by token
    const invite = await prisma.supplierInvite.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invite) {
      return { error: "Invalid invite link", details: "This invite link does not exist or has been revoked" };
    }

    if (new Date() > invite.expiresAt) {
      return { error: "Invite expired", details: "This invite link has expired. Please request a new one." };
    }

    if (invite.usedAt) {
      return { error: "Invite already used", details: "This invite link has already been accepted" };
    }

    // Mark invite as used
    await prisma.supplierInvite.update({
      where: { id: invite.id },
      data: {
        usedAt: new Date(),
        companyName: displayName,
      },
    });

    // Mark associated data requests as opened
    const dataRequests = await prisma.supplierDataRequest.findMany({
      where: {
        organizationId: invite.organizationId,
        supplierEmail: invite.email,
        status: "sent",
      },
      include: {
        createdBy: { select: { email: true } },
        reportingPeriod: { select: { label: true } },
      },
    });

    if (dataRequests.length > 0) {
      await Promise.all(
        dataRequests.map((req) =>
          prisma.supplierDataRequest.update({
            where: { id: req.id },
            data: { openedAt: new Date(), status: "opened" },
          }),
        ),
      );

      // Notify admin of acceptance for each request
      for (const req of dataRequests) {
        if (!req.createdBy?.email) continue;

        const categoryGuidance = CATEGORY_GUIDANCE[req.categoryCode];
        const categoryName = categoryGuidance?.categoryName || req.categoryCode;

        const dashboardLink = `${process.env.NEXT_PUBLIC_APP_URL}/orgs/${invite.organizationId}/settings/suppliers?requestId=${req.id}`;

        const emailPayload = inviteAcceptedEmail({
          adminEmail: req.createdBy.email,
          supplierName: displayName,
          supplierEmail: invite.email,
          categoryName,
          reportingPeriodLabel: req.reportingPeriod.label,
          dashboardLink,
        });

        // Send the email notification
        await sendTransactionalEmail(emailPayload);
      }
    }

    // Write audit log
    await writeAuditLog({
      organizationId: invite.organizationId,
      actorUserId: null, // Supplier action, no user context
      action: "supplier_invite.accepted",
      resourceType: "SupplierInvite",
      resourceId: invite.id,
      metadata: {
        email: invite.email,
        displayName,
        dataRequestCount: dataRequests.length,
      },
    });

    // Generate a portal token (could be JWT or session-based)
    // For now, use the existing mechanism if available, or create a new token
    // The portal can be accessed with the token from the data request itself

    // Return the portal token - use the first data request's token if available
    const portalToken = dataRequests[0]?.token || invite.token;

    return {
      success: true,
      portalToken,
    };
  } catch (error) {
    console.error("[acceptSupplierInvite] Error:", error);
    return {
      error: "Failed to accept invitation",
      details: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
