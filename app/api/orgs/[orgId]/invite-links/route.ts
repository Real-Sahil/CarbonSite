export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createInviteLinkSchema } from "@/lib/validation/org";
import { sendTransactionalEmail } from "@/lib/notifications/email";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin");

    const now = new Date();
    const links = await prisma.inviteLink.findMany({
      where: {
        organizationId: orgId,
        email: null,
        role: "field_worker",
        expiresAt: { gt: now },
        usedAt: null,
      },
      include: {
        site: { select: { id: true, name: true, project: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(links);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "invite-links", session.user.id),
      limit: 15,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = createInviteLinkSchema.parse(await req.json());

    // If the invite is scoped to a site, validate it belongs to this org.
    if (body.siteId) {
      const site = await prisma.site.findFirst({
        where: { id: body.siteId, organizationId: orgId },
        select: { id: true },
      });
      if (!site) {
        return apiError("INVALID_SITE", "Site does not belong to this organisation.", 422);
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + body.expiresInDays * 86_400_000);
    const token = randomUUID();

    const link = await prisma.inviteLink.create({
      data: {
        organizationId: orgId,
        role: body.role,
        token,
        expiresAt,
        siteId: body.siteId,
      },
      include: {
        site: { select: { id: true, name: true, project: { select: { name: true } } } },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.member.invite",
      resourceType: "invite_link",
      resourceId: link.id,
      metadata: { role: body.role, expiresInDays: body.expiresInDays, siteId: body.siteId },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const inviteUrl = `${appUrl}/invite/${token}`;

    if (body.email) {
      await sendTransactionalEmail({
        to: body.email,
        subject: "You've been invited to MetricOra",
        text: [
          `You've been invited to join MetricOra as a field worker.`,
          ``,
          `Click the link below to accept your invitation and set up your account:`,
          inviteUrl,
          ``,
          `This invitation expires in ${body.expiresInDays} day${body.expiresInDays !== 1 ? "s" : ""}.`,
          ``,
          `If you weren't expecting this invitation, you can safely ignore this email.`,
        ].join("\n"),
        html: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#f8f9fa;margin:0;padding:0">
<div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#0f172a;padding:24px 32px">
    <span style="color:#fff;font-size:18px;font-weight:600;letter-spacing:-0.02em">MetricOra</span>
  </div>
  <div style="padding:32px">
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827;letter-spacing:-0.02em">You've been invited</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">You've been invited to join MetricOra as a field worker. Click below to accept your invitation and set up your account.</p>
    <a href="${inviteUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">Accept invitation</a>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:12px">This invitation expires in ${body.expiresInDays} day${body.expiresInDays !== 1 ? "s" : ""}. If you weren't expecting this, you can safely ignore this email.</p>
    <p style="margin:8px 0 0;color:#9ca3af;font-size:12px">Or copy this link: <a href="${inviteUrl}" style="color:#f97316">${inviteUrl}</a></p>
  </div>
</div>
</body>
</html>`,
      }).catch((emailErr: unknown) => {
        console.error("[invite-links] email delivery failed", emailErr);
      });
    }

    return NextResponse.json({ ...link, inviteUrl }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
