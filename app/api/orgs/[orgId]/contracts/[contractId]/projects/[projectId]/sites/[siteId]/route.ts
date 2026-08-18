export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateSiteSchema } from "@/lib/validation/org";

async function resolveSite(orgId: string, projectId: string, siteId: string) {
  const s = await prisma.site.findUnique({ where: { id: siteId } });
  if (!s || s.organizationId !== orgId || s.projectId !== projectId) return null;
  return s;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string; projectId: string; siteId: string }> },
) {
  try {
    const { orgId, projectId, siteId } = await params;
    await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager",
      "operations_manager", "editor", "reviewer", "viewer", "auditor",
      "contract_manager", "project_manager", "site_manager", "supervisor",
      "client_viewer", "field_worker",
    );

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site || site.organizationId !== orgId || site.projectId !== projectId) {
      return apiError("NOT_FOUND", "Site not found.", 404);
    }

    return NextResponse.json(site);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string; projectId: string; siteId: string }> },
) {
  try {
    const { orgId, projectId, siteId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "contract_manager", "project_manager", "site_manager",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sites-update", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const existing = await resolveSite(orgId, projectId, siteId);
    if (!existing) return apiError("NOT_FOUND", "Site not found.", 404);

    const body = updateSiteSchema.parse(await req.json());

    const updated = await prisma.site.update({
      where: { id: siteId },
      data: {
        name: body.name,
        siteCode: body.siteCode ?? undefined,
        postcode: body.postcode ?? undefined,
        addressLine1: body.addressLine1 ?? undefined,
        city: body.city ?? undefined,
        country: body.country,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "site.updated",
      resourceType: "site",
      resourceId: siteId,
      metadata: { fields: Object.keys(body) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string; projectId: string; siteId: string }> },
) {
  try {
    const { orgId, projectId, siteId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "contract_manager", "project_manager",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sites-delete", session.user.id),
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const existing = await resolveSite(orgId, projectId, siteId);
    if (!existing) return apiError("NOT_FOUND", "Site not found.", 404);

    await prisma.site.delete({ where: { id: siteId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "site.deleted",
      resourceType: "site",
      resourceId: siteId,
      metadata: { name: existing.name, projectId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
