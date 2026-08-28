export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const createZoneSchema = z.object({
  name: z.string().min(1, "Zone name required"),
  postcode: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
});

async function resolveSite(
  orgId: string,
  contractId: string,
  projectId: string,
  siteId: string,
) {
  const s = await prisma.site.findUnique({
    where: { id: siteId },
    include: { project: true },
  });
  if (
    !s ||
    s.organizationId !== orgId ||
    s.projectId !== projectId ||
    s.project.contractId !== contractId
  ) {
    return null;
  }
  return s;
}

export async function GET(
  _req: NextRequest,
  { params }: {
    params: Promise<{ orgId: string; contractId: string; projectId: string; siteId: string }>;
  },
) {
  try {
    const { orgId, contractId, projectId, siteId } = await params;
    await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager",
      "operations_manager", "editor", "reviewer", "viewer", "auditor",
      "contract_manager", "project_manager", "site_manager", "supervisor", "client_viewer",
    );

    const site = await resolveSite(orgId, contractId, projectId, siteId);
    if (!site) return apiError("NOT_FOUND", "Site not found.", 404);

    const zones = await prisma.site.findMany({
      where: { organizationId: orgId, parentSiteId: siteId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(zones);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: {
    params: Promise<{ orgId: string; contractId: string; projectId: string; siteId: string }>;
  },
) {
  try {
    const { orgId, contractId, projectId, siteId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "contract_manager", "project_manager", "site_manager",
    );

    const site = await resolveSite(orgId, contractId, projectId, siteId);
    if (!site) return apiError("NOT_FOUND", "Site not found.", 404);

    const body = createZoneSchema.parse(await req.json());

    const zone = await prisma.site.create({
      data: {
        organizationId: orgId,
        projectId,
        parentSiteId: siteId,
        name: body.name,
        postcode: body.postcode ?? null,
        addressLine1: body.addressLine1 ?? null,
        city: body.city ?? null,
        country: site.country,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "site.created",
      resourceType: "site",
      resourceId: zone.id,
      metadata: { name: zone.name, parentSiteId: siteId, projectId },
    });

    return NextResponse.json(zone, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
