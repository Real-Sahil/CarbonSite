export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { handleRouteError, apiError } from "@/lib/validation/api";

// Supplier acceptance uses email + name only (no PIN, unlike field workers).
// The issued session token is used as a Bearer token from the supplier portal.
const schema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100).trim(),
});

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitRequest(req, {
      key: "supplier_invite_accept",
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (limited) return limited;

    const body = schema.parse(await req.json());

    const invite = await prisma.supplierInvite.findUnique({
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
      return apiError(
        "INVITE_ALREADY_USED",
        "This invite link has already been used.",
        400,
      );
    }

    // An existing account joins only from its own signed-in session,
    // so the link alone never signs anyone in.
    const existing = await prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existing) {
      const signedIn = await getSession();
      if (signedIn?.user.id !== existing.id) {
        return apiError(
          "SIGN_IN_TO_ACCEPT",
          "Sign in with the invited email address to accept this invite.",
          409,
        );
      }
      const member = await prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: { organizationId: invite.organizationId, userId: existing.id },
        },
        select: { id: true },
      });
      if (member) {
        return apiError("ALREADY_MEMBER", "This user is already a member of the organisation.", 409);
      }
    }

    const userId = existing?.id ?? randomUUID();
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    const claimed = await prisma.$transaction(async (tx) => {
      // Claim first: a concurrent accept of the same link finds it used and writes nothing.
      const claim = await tx.supplierInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: now, usedByUserId: userId },
      });
      if (claim.count === 0) return false;

      if (!existing) {
        await tx.user.create({
          data: {
            id: userId,
            email: invite.email,
            name: body.name,
            emailVerifiedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        });
        await tx.session.create({
          data: {
            id: randomUUID(),
            token: sessionToken,
            userId,
            expiresAt,
            createdAt: now,
            updatedAt: now,
          },
        });
      } else if (!existing.name && body.name) {
        await tx.user.update({
          where: { id: userId },
          data: { name: body.name, updatedAt: now },
        });
      }

      await tx.organizationMembership.create({
        data: { organizationId: invite.organizationId, userId, role: "supplier" },
      });
      return true;
    });
    if (!claimed) {
      return apiError("INVITE_ALREADY_USED", "This invite link has already been used.", 400);
    }

    await writeAuditLog({
      organizationId: invite.organizationId,
      actorUserId: userId,
      action: "supplier_invite.accepted",
      resourceType: "SupplierInvite",
      resourceId: invite.id,
      metadata: { email: invite.email },
    });

    return NextResponse.json({
      // An existing account already holds its own session, so none is issued here.
      ...(existing ? {} : { sessionToken, expiresAt: expiresAt.toISOString() }),
      user: { id: userId, name: existing?.name || body.name, email: invite.email },
      org: {
        id: invite.organization.id,
        name: invite.organization.name,
      },
      role: "supplier",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
