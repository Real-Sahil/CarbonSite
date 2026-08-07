import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
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
      include: {
        site: { select: { id: true, name: true, project: { select: { name: true } } } },
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
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "invite-links", session.user.id),
      limit: 15,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = createInviteLinkSchema.parse(await req.json());

    // If the invite is scoped to a site, validate it belongs to this org.
    if (body.siteId) {
      const site = await prisma.site.findFirst({
        where: { id: body.siteId, organizationId: orgId },
        select: { id: true },
      });
      if (!site) {
        return apiError("INVALID_SITE", "Site does not belong to this organisation.", 422);
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + body.expiresInDays * 86_400_000);
    const token = randomUUID();

    const link = await prisma.inviteLink.create({
      data: {
        organizationId: orgId,
        role: body.role,
        token,
        expiresAt,
        siteId: body.siteId,
      },
      include: {
        site: { select: { id: true, name: true, project: { select: { name: true } } } },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.member.invite",
      resourceType: "invite_link",
      resourceId: link.id,
      metadata: { role: body.role, expiresInDays: body.expiresInDays, siteId: body.siteId },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const inviteUrl = `${appUrl}/invite/${token}`;

    return NextResponse.json({ ...link, inviteUrl }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
