export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { dispatchNotification } from "@/lib/jobs/dispatch";

const createSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  companyName: z.string().max(200).trim().optional(),
  inviteMethod: z.enum(["magic-link", "credentials"]).default("magic-link"),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

// GET /api/orgs/[orgId]/supplier-invites — list pending invites (admin only)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const invites = await prisma.supplierInvite.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        email: true,
        companyName: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        inviteMethod: true,
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        companyName: inv.companyName,
        expiresAt: inv.expiresAt.toISOString(),
        usedAt: inv.usedAt?.toISOString() ?? null,
        createdAt: inv.createdAt.toISOString(),
        inviteMethod: inv.inviteMethod,
        createdBy: inv.createdBy.name ?? inv.createdBy.email,
        status: inv.usedAt ? "accepted" : inv.expiresAt <= new Date() ? "expired" : "pending",
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/supplier-invites — create invite (admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = createSchema.parse(await req.json());

    const alreadyMember = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: orgId,
        user: { email: body.email },
        role: "supplier",
      },
    });
    if (alreadyMember) {
      return apiError(
        "ALREADY_MEMBER",
        "This supplier already has access to your organisation.",
        409,
      );
    }

    const expiresAt = new Date(
      Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000,
    );

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    let userId: string | undefined;
    let temporaryPassword: string | undefined;

    // If admin wants to create credentials, generate password and create user account
    if (body.inviteMethod === "credentials") {
      const tempPwd = generateTemporaryPassword();
      temporaryPassword = tempPwd;

      // Create or fetch user
      let user = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: body.email,
            name: body.companyName || body.email.split("@")[0],
          },
        });
      }

      // Store password in Account table (Better Auth credential provider)
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(tempPwd, 10);
      const existingAccount = await prisma.account.findFirst({
        where: { userId: user.id, providerId: "credential" },
      });
      if (existingAccount) {
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: { password: hashedPassword },
        });
      } else {
        await prisma.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: hashedPassword,
          },
        });
      }

      // Create organization membership
      const existingMembership = await prisma.organizationMembership.findFirst({
        where: {
          organizationId: orgId,
          userId: user.id,
        },
      });

      if (!existingMembership) {
        await prisma.organizationMembership.create({
          data: {
            organizationId: orgId,
            userId: user.id,
            role: "supplier",
          },
        });
      }

      userId = user.id;
    }

    const invite = await prisma.supplierInvite.create({
      data: {
        organizationId: orgId,
        email: body.email,
        companyName: body.companyName ?? null,
        expiresAt,
        createdByUserId: session.user.id,
        inviteMethod: body.inviteMethod,
        usedByUserId: userId, // Mark as used if credentials method
        usedAt: userId ? new Date() : undefined,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "supplier_invite.created",
      resourceType: "SupplierInvite",
      resourceId: invite.id,
      metadata: {
        email: invite.email,
        companyName: invite.companyName,
        inviteMethod: body.inviteMethod,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonsite-rosy.vercel.app";
    const loginUrl = `${appUrl}/sign-in`;
    const inviteUrl = `${appUrl}/supplier-invite/${invite.token}`;

    try {
      if (body.inviteMethod === "credentials" && temporaryPassword) {
        // Send credentials email
        const { sendSupplierCredentialsEmail } = await import("@/workers/supplier-invite-email");
        await sendSupplierCredentialsEmail({
          supplierEmail: body.email,
          temporaryPassword,
          loginUrl,
          invitedByName: session.user.name || session.user.email,
          organizationName: org?.name || "CarbonSite",
          companyName: body.companyName,
        });
      } else {
        // Send magic link email
        const { sendSupplierInviteEmail } = await import("@/workers/supplier-invite-email");
        await sendSupplierInviteEmail({
          supplierEmail: body.email,
          inviteUrl,
          invitedByName: session.user.name || session.user.email,
          organizationName: org?.name || "CarbonSite",
          companyName: body.companyName,
        });
      }
    } catch (emailError) {
      console.error("[SupplierInvite] Email dispatch failed:", emailError);
    }

    dispatchNotification({
      type: "task_assigned",
      recipientUserId: session.user.id,
      orgId,
      resourceId: invite.id,
      metadata: { targetLabel: `Supplier invite for ${body.email} (${body.inviteMethod})` },
    }).catch(() => {});

    return NextResponse.json(
      {
        id: invite.id,
        email: invite.email,
        companyName: invite.companyName,
        inviteMethod: body.inviteMethod,
        inviteUrl: body.inviteMethod === "magic-link" ? inviteUrl : undefined,
        loginUrl: body.inviteMethod === "credentials" ? loginUrl : undefined,
        expiresAt: invite.expiresAt.toISOString(),
        message:
          body.inviteMethod === "credentials"
            ? "Supplier account created. Temporary password sent via email."
            : "Magic link invitation sent via email.",
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

