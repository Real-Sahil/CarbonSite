export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createSiteSchema } from "@/lib/validation/org";

async function resolveProject(orgId: string, contractId: string, projectId: string) {
  const p = await prisma.project.findUnique({ where: { id: projectId } });
  if (!p || p.organizationId !== orgId || p.contractId !== contractId) return null;
  return p;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string; projectId: string }> },
) {
  try {
    const { orgId, contractId, projectId } = await params;
    await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager",
      "operations_manager", "editor", "reviewer", "viewer", "auditor",
      "contract_manager", "project_manager", "site_manager", "supervisor",
      "client_viewer", "field_worker",
    );

    const project = await resolveProject(orgId, contractId, projectId);
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const sites = await prisma.site.findMany({
      where: { organizationId: orgId, projectId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(sites);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string; projectId: string }> },
) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "contract_manager", "project_manager", "site_manager",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sites-create", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const project = await resolveProject(orgId, contractId, projectId);
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const body = createSiteSchema.parse(await req.json());

    const site = await prisma.site.create({
      data: {
        organizationId: orgId,
        projectId,
        name: body.name,
        siteCode: body.siteCode ?? null,
        postcode: body.postcode ?? null,
        addressLine1: body.addressLine1 ?? null,
        city: body.city ?? null,
        country: body.country,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "site.created",
      resourceType: "site",
      resourceId: site.id,
      metadata: { name: site.name, projectId, contractId },
    });

    return NextResponse.json(site, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
