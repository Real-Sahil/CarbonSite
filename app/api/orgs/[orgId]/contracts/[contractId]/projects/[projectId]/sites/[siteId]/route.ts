export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateSiteSchema } from "@/lib/validation/project-carbon";

type Params = { params: Promise<{ orgId: string; contractId: string; projectId: string; siteId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, projectId, siteId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const site = await prisma.site.findFirst({ where: { id: siteId, projectId, organizationId: orgId } });
    if (!site) return apiError("NOT_FOUND", "Site not found.", 404);

    return NextResponse.json({ site });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, projectId, siteId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);

    const existing = await prisma.site.findFirst({ where: { id: siteId, projectId, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", "Site not found.", 404);

    const body = await req.json().catch(() => null);
    const parsed = updateSiteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid site data.", 400, parsed.error.flatten());
    }

    const site = await prisma.site.update({ where: { id: siteId }, data: parsed.data });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "site.updated",
      resourceType: "Site",
      resourceId: siteId,
      metadata: { changes: parsed.data },
    });

    return NextResponse.json({ site });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, projectId, siteId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);

    const existing = await prisma.site.findFirst({ where: { id: siteId, projectId, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", "Site not found.", 404);

    await prisma.site.delete({ where: { id: siteId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "site.deleted",
      resourceType: "Site",
      resourceId: siteId,
      metadata: { projectId, name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
