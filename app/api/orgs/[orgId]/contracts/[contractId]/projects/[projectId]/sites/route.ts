export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createSiteSchema } from "@/lib/validation/project-carbon";

type Params = { params: Promise<{ orgId: string; contractId: string; projectId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const project = await prisma.project.findFirst({ where: { id: projectId, contractId, organizationId: orgId } });
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const sites = await prisma.site.findMany({
      where: { projectId, organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ sites });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);

    const project = await prisma.project.findFirst({ where: { id: projectId, contractId, organizationId: orgId } });
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const body = await req.json().catch(() => null);
    const parsed = createSiteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid site data.", 400, parsed.error.flatten());
    }
    const data = parsed.data;

    const site = await prisma.site.create({
      data: {
        organizationId: orgId,
        projectId,
        name: data.name,
        siteCode: data.siteCode,
        postcode: data.postcode,
        addressLine1: data.addressLine1,
        city: data.city,
        country: data.country,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "site.created",
      resourceType: "Site",
      resourceId: site.id,
      metadata: { projectId, name: site.name },
    });

    return NextResponse.json({ site }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
