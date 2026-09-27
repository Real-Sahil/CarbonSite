export const dynamic = "force-dynamic";

// Links for a certification body's auditor: list and create. The token is
// shown once, in the create response; only its hash is kept.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { MS_EDITORS } from "@/lib/management-systems/access";
import { auditorAccessSchema, hashToken, newToken } from "@/lib/management-systems/auditor-access";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...MS_EDITORS);
    const rows = await prisma.msAuditorAccess.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, email: true, company: true, frameworks: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ data: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const body = auditorAccessSchema.parse(await req.json());
    const adopted = await prisma.msFrameworkAdoption.findMany({
      where: { organizationId: orgId, frameworkSlug: { in: body.frameworks }, status: { not: "withdrawn" } },
      select: { frameworkSlug: true },
    });
    if (adopted.length !== body.frameworks.length) return apiError("VALIDATION_ERROR", "Share only frameworks this organisation has adopted.", 422);

    const token = newToken();
    const access = await prisma.msAuditorAccess.create({
      data: {
        organizationId: orgId,
        name: body.name,
        email: body.email ?? null,
        company: body.company ?? null,
        frameworks: body.frameworks,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + body.days * 86_400_000),
        createdByUserId: session.user.id,
      },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.auditor_access_granted",
      resourceType: "MsAuditorAccess",
      resourceId: access.id,
      metadata: { name: body.name, company: body.company ?? null, frameworks: body.frameworks, expiresAt: access.expiresAt.toISOString() },
    });
    const url = new URL(`/ms-audit/${token}`, req.nextUrl.origin).toString();
    return Response.json({ id: access.id, url, expiresAt: access.expiresAt }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
