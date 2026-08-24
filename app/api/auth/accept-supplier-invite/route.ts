export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit";
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

    // Find or create the supplier user account.
    let user = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: randomUUID(),
          email: invite.email,
          name: body.name,
          emailVerifiedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    } else if (!user.name && body.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: body.name, updatedAt: now },
      });
    }

    // Upsert membership with supplier role.
    await prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: user.id,
        },
      },
      create: {
        organizationId: invite.organizationId,
        userId: user.id,
        role: "supplier",
      },
      update: { role: "supplier" },
    });

    // Mark invite used and issue a session token.
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    await prisma.$transaction([
      prisma.supplierInvite.update({
        where: { id: invite.id },
        data: { usedAt: now, usedByUserId: user.id },
      }),
      prisma.session.create({
        data: {
          id: randomUUID(),
          token: sessionToken,
          userId: user.id,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        },
      }),
    ]);

    await writeAuditLog({
      organizationId: invite.organizationId,
      actorUserId: user.id,
      action: "supplier_invite.accepted",
      resourceType: "SupplierInvite",
      resourceId: invite.id,
      metadata: { email: invite.email },
    });

    return NextResponse.json({
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, name: user.name, email: user.email },
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
