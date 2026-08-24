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

    const invite = await prisma.supplierInvite.create({
      data: {
        organizationId: orgId,
        email: body.email,
        companyName: body.companyName ?? null,
        expiresAt,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "supplier_invite.created",
      resourceType: "SupplierInvite",
      resourceId: invite.id,
      metadata: { email: invite.email, companyName: invite.companyName },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonsite-rosy.vercel.app";
    const inviteUrl = `${appUrl}/supplier-invite/${invite.token}`;

    dispatchNotification({
      type: "task_assigned",
      recipientUserId: session.user.id,
      orgId,
      resourceId: invite.id,
      metadata: { targetLabel: `Supplier invite for ${body.email}` },
    }).catch(() => {});

    return NextResponse.json(
      {
        id: invite.id,
        email: invite.email,
        companyName: invite.companyName,
        inviteUrl,
        expiresAt: invite.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
