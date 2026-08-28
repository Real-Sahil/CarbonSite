export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const createFacilitySchema = z.object({
  name: z.string().min(1, "Facility name required"),
  country: z.string().optional(),
  region: z.string().optional(),
});

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
      "contract_manager", "project_manager", "client_viewer",
    );

    const project = await resolveProject(orgId, contractId, projectId);
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const facilities = await prisma.facility.findMany({
      where: { organizationId: orgId, projectId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(facilities);
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
      orgId, "admin", "sustainability_director", "contract_manager", "project_manager",
    );

    const project = await resolveProject(orgId, contractId, projectId);
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const body = createFacilitySchema.parse(await req.json());

    const facility = await prisma.facility.create({
      data: {
        organizationId: orgId,
        projectId,
        name: body.name,
        country: body.country ?? null,
        region: body.region ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "facility.created",
      resourceType: "facility",
      resourceId: facility.id,
      metadata: { name: facility.name, projectId },
    });

    return NextResponse.json(facility, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
