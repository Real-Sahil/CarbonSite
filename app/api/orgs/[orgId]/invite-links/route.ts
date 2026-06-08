import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { createInviteLinkSchema } from "@/lib/validation/org";

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
    const body = createInviteLinkSchema.parse(await req.json());

    const now = new Date();
    const expiresAt = new Date(now.getTime() + body.expiresInDays * 86_400_000);
    const token = randomUUID();

    const link = await prisma.inviteLink.create({
      data: {
        organizationId: orgId,
        role: body.role,
        token,
        expiresAt,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.member.invite",
      resourceType: "invite_link",
      resourceId: link.id,
      metadata: { role: body.role, expiresInDays: body.expiresInDays },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const inviteUrl = `${appUrl}/invite/${token}`;

    return NextResponse.json({ ...link, inviteUrl }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
