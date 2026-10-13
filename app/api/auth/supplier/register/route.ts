import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { hashPassword } from "better-auth/crypto";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteToken: z.string(),
  // Accepted for older clients but ignored: the invite decides the org.
  organizationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitRequest(req, {
      key: "supplier_register",
      limit: 10,
      windowMs: 15 * 60_000,
    });
    if (limited) return limited;

    const body = schema.parse(await req.json());

    const invite = await prisma.supplierInvite.findUnique({
      where: { token: body.inviteToken },
      select: {
        id: true,
        email: true,
        organizationId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!invite) {
      return apiError("INVALID_INVITE", "Invitation not found", 404);
    }

    if (invite.usedAt) {
      return apiError("ALREADY_USED", "This invitation has already been used", 400);
    }

    if (invite.expiresAt < new Date()) {
      return apiError("EXPIRED", "This invitation has expired", 400);
    }

    if (body.email !== invite.email) {
      return apiError("EMAIL_MISMATCH", "Email does not match the invitation", 400);
    }

    // An existing account keeps its own password: setting one here would take the account over.
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existingUser) {
      return apiError(
        "ACCOUNT_EXISTS",
        "An account already exists for this email. Sign in with it instead.",
        409,
      );
    }

    const userId = randomUUID();
    const hashedPassword = await hashPassword(body.password);

    const claimed = await prisma.$transaction(async (tx) => {
      // Claim first: a second registration on the same link finds it used and creates nothing.
      const claim = await tx.supplierInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: new Date(), usedByUserId: userId },
      });
      if (claim.count === 0) return false;

      await tx.user.create({
        data: {
          id: userId,
          email: body.email,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
      await tx.account.create({
        data: {
          userId,
          accountId: userId,
          providerId: "credential",
          password: hashedPassword,
        },
      });
      await tx.organizationMembership.create({
        data: {
          userId,
          organizationId: invite.organizationId,
          role: "supplier",
        },
      });
      return true;
    });
    if (!claimed) {
      return apiError("ALREADY_USED", "This invitation has already been used", 400);
    }

    await writeAuditLog({
      organizationId: invite.organizationId,
      actorUserId: userId,
      action: "supplier_account.created",
      resourceType: "User",
      resourceId: userId,
      metadata: { email: body.email, inviteId: invite.id },
    });

    return NextResponse.json(
      {
        userId,
        email: body.email,
        organizationId: invite.organizationId,
        role: "supplier",
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
