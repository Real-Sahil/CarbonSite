import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { acceptInviteSchema } from "@/lib/validation/org";

export async function POST(req: NextRequest) {
  try {
    const body = acceptInviteSchema.parse(await req.json());
    // Rate-limit by IP, not by token — prevents enumeration via per-token buckets.
    const limited = rateLimitRequest(req, {
      key: "invite_accept",
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (limited) return limited;

    // 1. Look up and validate the invite link
    const invite = await prisma.inviteLink.findUnique({
      where: { token: body.token },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!invite) {
      return apiError("INVITE_NOT_FOUND", "Invite link not found.", 404);
    }

    const now = new Date();

    if (invite.expiresAt <= now) {
      return apiError("INVITE_EXPIRED", "This invite link has expired.", 400);
    }

    if (invite.usedAt !== null) {
      return apiError("INVITE_ALREADY_USED", "This invite link has already been used.", 400);
    }
    if (!invite.email && invite.role !== "field_worker") {
      return apiError(
        "INVITE_REQUIRES_EMAIL",
        "Privileged organisation roles must be accepted through an email-bound invite.",
        400,
      );
    }

    const requestedEmail = body.email?.trim().toLowerCase();
    if (invite.email && requestedEmail && requestedEmail !== invite.email.toLowerCase()) {
      // Return the same message as INVITE_NOT_FOUND to prevent email enumeration.
      return apiError(
        "INVALID_INVITE",
        "This invite link is invalid or has expired.",
        400,
      );
    }
    if (invite.email && !requestedEmail && invite.role !== "field_worker") {
      return apiError(
        "INVITE_EMAIL_REQUIRED",
        "This invite must be accepted with the invited email address.",
        400,
      );
    }

    // 2. Determine the email for this invite acceptance
    const email =
      invite.email?.toLowerCase() ??
      requestedEmail ??
      `fw-${randomUUID().substring(0, 8)}@field.carbonsite.app`;

    // 3. Find or create the user
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const userId = randomUUID();
      user = await prisma.user.create({
        data: {
          id: userId,
          email,
          emailVerified: Boolean(invite.email),
          emailVerifiedAt: invite.email ? now : null,
          name: body.name,
        },
      });

      // Create a credential account (no password — JWT-only auth for field workers)
      await prisma.account.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          accountId: email,
          providerId: "credential",
          password: null,
        },
      });
    }

    // 4. Check user is not already a member of this org
    const existingMembership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      return apiError(
        "ALREADY_MEMBER",
        "This user is already a member of the organization.",
        409,
      );
    }

    // 5. Create membership, mark invite used, create session — all in a transaction
    const sessionToken = randomUUID();
    const sessionId = randomUUID();
    const sessionExpiresAt = new Date(now.getTime() + 30 * 86_400_000); // 30 days

    const membership = await prisma.$transaction(async (tx) => {
      const mem = await tx.organizationMembership.create({
        data: {
          organizationId: invite.organizationId,
          userId: user!.id,
          role: invite.role,
        },
      });

      await tx.inviteLink.update({
        where: { id: invite.id },
        data: { usedAt: now, usedByUserId: user!.id },
      });

      await tx.session.create({
        data: {
          id: sessionId,
          token: sessionToken,
          userId: user!.id,
          expiresAt: sessionExpiresAt,
        },
      });

      return mem;
    });

    // 6. Audit log
    await writeAuditLog({
      organizationId: invite.organizationId,
      actorUserId: user.id,
      action: "org.member.invite_accepted",
      resourceType: "invite_link",
      resourceId: invite.id,
      metadata: {
        acceptedByUserId: user.id,
        email,
        role: invite.role,
        membershipId: membership.id,
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      sessionToken,
      org: {
        id: invite.organization.id,
        name: invite.organization.name,
      },
      role: invite.role,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
