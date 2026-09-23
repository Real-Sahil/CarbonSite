export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { resolveEmailLogoUrl } from "@/lib/notifications/email";
import { generateTemporaryPassword, hashTemporaryPassword } from "@/lib/auth/temporary-password";

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

    const [org, branding] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.tenantBranding.findUnique({ where: { organizationId: orgId }, select: { logoPublicUrl: true, reportHeaderLogoKey: true, logoStorageKey: true } }),
    ]);

    let userId: string | undefined;
    let temporaryPassword: string | undefined;

    // Someone who already has a MetricOra account keeps their own password:
    // setting one here would lock them out of every other org they use. They
    // get an invite link instead and accept it with their existing sign-in.
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    const inviteMethod = body.inviteMethod === "credentials" && existingUser ? "magic-link" : body.inviteMethod;

    if (inviteMethod === "credentials") {
      temporaryPassword = generateTemporaryPassword();
      const password = await hashTemporaryPassword(temporaryPassword);
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: body.email,
            name: body.companyName || body.email.split("@")[0],
          },
        });
        await tx.account.create({
          data: { userId: created.id, accountId: created.id, providerId: "credential", password },
        });
        await tx.organizationMembership.create({
          data: { organizationId: orgId, userId: created.id, role: "supplier" },
        });
        return created;
      });
      userId = user.id;
    }

    const invite = await prisma.supplierInvite.create({
      data: {
        organizationId: orgId,
        email: body.email,
        companyName: body.companyName ?? null,
        expiresAt,
        createdByUserId: session.user.id,
        inviteMethod,
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
        inviteMethod,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.metricora.co.uk";
    const loginUrl = `${appUrl}/sign-in`;
    const inviteUrl = `${appUrl}/supplier-invite/${invite.token}`;

    try {
      const orgLogoUrl = branding ? await resolveEmailLogoUrl(branding) : null;
      if (inviteMethod === "credentials" && temporaryPassword) {
        const { sendSupplierCredentialsEmail } = await import("@/workers/supplier-invite-email");
        await sendSupplierCredentialsEmail({
          supplierEmail: body.email,
          temporaryPassword,
          loginUrl,
          invitedByName: session.user.name || session.user.email,
          organizationName: org?.name || "MetricOra",
          companyName: body.companyName,
          orgLogoUrl,
        });
      } else {
        const { sendSupplierInviteEmail } = await import("@/workers/supplier-invite-email");
        await sendSupplierInviteEmail({
          supplierEmail: body.email,
          inviteUrl,
          invitedByName: session.user.name || session.user.email,
          organizationName: org?.name || "MetricOra",
          companyName: body.companyName,
          orgLogoUrl,
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
      metadata: { targetLabel: `Supplier invite for ${body.email} (${inviteMethod})` },
    }).catch(() => {});

    return NextResponse.json(
      {
        id: invite.id,
        email: invite.email,
        companyName: invite.companyName,
        inviteMethod,
        inviteUrl: inviteMethod === "magic-link" ? inviteUrl : undefined,
        loginUrl: inviteMethod === "credentials" ? loginUrl : undefined,
        expiresAt: invite.expiresAt.toISOString(),
        message:
          inviteMethod === "credentials"
            ? "Supplier account created. Temporary password sent via email."
            : inviteMethod !== body.inviteMethod
              ? "This email already has a MetricOra account, so we sent an invite link instead. They accept it with their existing sign-in."
              : "Magic link invitation sent via email.",
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
