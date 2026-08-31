import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { hash } from "bcryptjs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteToken: z.string(),
  organizationId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
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

    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    let user;
    if (existingUser) {
      user = existingUser;
    } else {
      user = await prisma.user.create({
        data: {
          email: body.email,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    }

    const hashedPassword = await hash(body.password, 12);
    const existing = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });

    if (!existing) {
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });
    }

    const existing_membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        organizationId: body.organizationId,
      },
    });

    if (!existing_membership) {
      await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: body.organizationId,
          role: "supplier",
        },
      });
    }

    await prisma.supplierInvite.update({
      where: { id: invite.id },
      data: {
        usedAt: new Date(),
        usedByUserId: user.id,
      },
    });

    await writeAuditLog({
      organizationId: body.organizationId,
      actorUserId: user.id,
      action: "supplier_account.created",
      resourceType: "User",
      resourceId: user.id,
      metadata: { email: user.email, inviteId: invite.id },
    });

    return NextResponse.json(
      {
        userId: user.id,
        email: user.email,
        organizationId: body.organizationId,
        role: "supplier",
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
