import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { inviteMemberSchema } from "@/lib/validation/org";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { sendTransactionalEmail } from "@/lib/notifications/email";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(members);
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
    const body = inviteMemberSchema.parse(await req.json());
    const limited = rateLimit(req, {
      key: rateLimitKey(orgId, "member_invites", session.user.id),
      limit: 15,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const email = body.email.trim().toLowerCase();
    const [organization, user] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true },
      }),
    ]);

    if (user) {
      const existing = await prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId: user.id },
        },
      });
      if (existing) {
        return apiError("ALREADY_MEMBER", "User is already a member of this organization.", 409);
      }

      const membership = await prisma.organizationMembership.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role: body.role,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      let delivery = "email";
      await sendTransactionalEmail({
        to: email,
        subject: `[CarbonSite] ${organization.name}: access granted`,
        text: [
          `${session.user.name ?? session.user.email} added you to ${organization.name} on CarbonSite.`,
          `Role: ${membership.role.replaceAll("_", " ")}`,
          `Open workspace: ${appUrl}/orgs/${orgId}/dashboard`,
        ].join("\n"),
      }).catch((emailErr: unknown) => {
        delivery = "email_failed";
        console.error("[members] direct add notification failed", emailErr);
      });

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "org.member.added",
        resourceType: "membership",
        resourceId: membership.id,
        metadata: {
          targetUserId: user.id,
          email,
          role: membership.role,
          accountState: "existing_user",
          delivery,
        },
      });

      return NextResponse.json(
        {
          action: "member_added",
          emailDelivery: delivery,
          membership,
        },
        { status: 201 },
      );
    }

    const now = new Date();
    const existingInvite = await prisma.inviteLink.findFirst({
      where: {
        organizationId: orgId,
        email,
        role: body.role,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
    const invite =
      existingInvite ??
      (await prisma.inviteLink.create({
        data: {
          organizationId: orgId,
          email,
          role: body.role,
          token: randomUUID(),
          expiresAt: new Date(now.getTime() + 7 * 86_400_000),
        },
      }));

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite/${invite.token}`;
    let delivery = "email";
    await sendTransactionalEmail({
      to: email,
      subject: `[CarbonSite] ${organization.name}: you have been invited`,
      text: [
        `${session.user.name ?? session.user.email} invited you to ${organization.name} on CarbonSite.`,
        `Role: ${invite.role.replaceAll("_", " ")}`,
        `Accept invite: ${inviteUrl}`,
        `This invite expires on ${invite.expiresAt.toLocaleDateString("en-GB")}.`,
      ].join("\n"),
    }).catch((emailErr) => {
      delivery = "email_failed";
      console.error("[members] invite email failed", emailErr);
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.member.invite",
      resourceType: "invite_link",
      resourceId: invite.id,
      metadata: {
        email,
        role: invite.role,
        delivery,
        reusedExistingInvite: Boolean(existingInvite),
      },
    });

    return NextResponse.json(
      {
        id: invite.id,
        email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        inviteUrl,
        emailDelivery: delivery,
      },
      { status: existingInvite ? 200 : 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
