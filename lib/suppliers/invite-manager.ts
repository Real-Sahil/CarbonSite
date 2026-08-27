import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { supplierInviteEmail, inviteAcceptedEmail } from "./email-templates";
import { CATEGORY_GUIDANCE } from "./category-guidance";

type InviteEmailResult = { success: true; messageId: string | null };

export async function resendSupplierInvite(params: {
  inviteId: string;
  orgId: string;
  orgName: string;
}): Promise<InviteEmailResult> {
  const { inviteId, orgId, orgName } = params;

  const invite = await prisma.supplierInvite.findUnique({
    where: { id: inviteId },
    include: { organization: true },
  });

  if (!invite) throw new Error("Invite not found");
  if (invite.organizationId !== orgId) throw new Error("Unauthorized");
  if (new Date() > invite.expiresAt) throw new Error("Invite has expired");

  // Re-send the invite email
  const emailPayload = supplierInviteEmail({
    supplierEmail: invite.email,
    supplierName: invite.companyName || undefined,
    inviteToken: invite.token,
    categoryName: "Data Request",
    reportingPeriodLabel: "Q3 2026", // TODO: get from context if available
    orgName: orgName || invite.organization.name || "Organization",
  });

  const emailResult = await sendTransactionalEmail(emailPayload);

  const result: InviteEmailResult = {
    success: true,
    messageId: emailResult.messageId,
  };
  return result;
}

export async function revokeSupplierInvite(params: {
  inviteId: string;
  orgId: string;
}): Promise<{ success: boolean }> {
  const { inviteId, orgId } = params;

  const invite = await prisma.supplierInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite) throw new Error("Invite not found");
  if (invite.organizationId !== orgId) throw new Error("Unauthorized");

  // Mark as expired
  await prisma.supplierInvite.update({
    where: { id: inviteId },
    data: { expiresAt: new Date() },
  });

  return { success: true };
}

export async function notifyAdminOfAcceptance(params: {
  requestId: string;
  orgId: string;
  adminEmail: string;
  orgName: string;
}): Promise<InviteEmailResult> {
  const { requestId, orgId, adminEmail, orgName } = params;

  const request = await prisma.supplierDataRequest.findUnique({
    where: { id: requestId },
    include: { reportingPeriod: true },
  });

  if (!request) throw new Error("Request not found");
  if (request.organizationId !== orgId) throw new Error("Unauthorized");

  const categoryGuidance = CATEGORY_GUIDANCE[request.categoryCode];
  const categoryName = categoryGuidance?.categoryName || request.categoryCode;

  const dashboardLink = `${process.env.NEXT_PUBLIC_APP_URL}/orgs/${orgId}/settings/suppliers?requestId=${requestId}`;

  const emailPayload = inviteAcceptedEmail({
    adminEmail,
    supplierName: request.supplierName || undefined,
    supplierEmail: request.supplierEmail,
    categoryName,
    reportingPeriodLabel: request.reportingPeriod.label,
    dashboardLink,
  });

  const emailResult = await sendTransactionalEmail(emailPayload);

  const result: InviteEmailResult = {
    success: true,
    messageId: emailResult.messageId,
  };
  return result;
}

export type InviteStats = {
  total: number;
  pending: number;
  accepted: number;
  expired: number;
};

export async function getInviteStats(orgId: string): Promise<InviteStats> {
  const now = new Date();

  const [total, accepted, expired] = await Promise.all([
    prisma.supplierInvite.count({
      where: { organizationId: orgId },
    }),
    prisma.supplierInvite.count({
      where: {
        organizationId: orgId,
        usedAt: { not: null },
      },
    }),
    prisma.supplierInvite.count({
      where: {
        organizationId: orgId,
        expiresAt: { lt: now },
      },
    }),
  ]);

  return {
    total,
    accepted,
    expired,
    pending: total - accepted - expired,
  };
}
