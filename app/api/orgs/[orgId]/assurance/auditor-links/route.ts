export const dynamic = "force-dynamic";

// Links for an independent verifier to one published snapshot's assurance pack. The token is shown
// once, in the create response; only its hash is kept.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { hashToken, newToken } from "@/lib/management-systems/auditor-access";
import { auditorLinkSchema, LINK_ROLES } from "@/lib/assurance/auditor-link";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...LINK_ROLES);
    const rows = await prisma.inventoryAuditorAccess.findMany({
      where: { organizationId: orgId },
      select: { id: true, snapshotId: true, engagementId: true, name: true, email: true, company: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Response.json({ data: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ROLES);
    const body = auditorLinkSchema.parse(await req.json());

    const snapshot = await prisma.publishedSnapshot.findFirst({ where: { id: body.snapshotId, organizationId: orgId }, select: { id: true } });
    if (!snapshot) return apiError("NOT_FOUND", "Snapshot not found.", 404);
    if (body.engagementId) {
      const engagement = await prisma.assuranceEngagement.findFirst({ where: { id: body.engagementId, organizationId: orgId }, select: { id: true } });
      if (!engagement) return apiError("NOT_FOUND", "Engagement not found.", 404);
    }

    const token = newToken();
    const access = await prisma.inventoryAuditorAccess.create({
      data: {
        organizationId: orgId,
        snapshotId: body.snapshotId,
        engagementId: body.engagementId ?? null,
        name: body.name,
        email: body.email ?? null,
        company: body.company ?? null,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + body.days * 86_400_000),
        createdByUserId: session.user.id,
      },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.auditor_link_granted",
      resourceType: "InventoryAuditorAccess",
      resourceId: access.id,
      metadata: { name: body.name, company: body.company ?? null, snapshotId: body.snapshotId, engagementId: body.engagementId ?? null, expiresAt: access.expiresAt.toISOString() },
    });
    const url = new URL(`/inventory-audit/${token}`, req.nextUrl.origin).toString();
    return Response.json({ id: access.id, url, expiresAt: access.expiresAt }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
