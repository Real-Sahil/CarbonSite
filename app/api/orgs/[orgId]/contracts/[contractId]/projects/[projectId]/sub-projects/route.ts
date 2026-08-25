export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createProjectSchema } from "@/lib/validation/org";

async function resolveParentProject(orgId: string, contractId: string, projectId: string) {
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

    const parentProject = await resolveParentProject(orgId, contractId, projectId);
    if (!parentProject) return apiError("NOT_FOUND", "Parent project not found.", 404);

    const subProjects = await prisma.project.findMany({
      where: { organizationId: orgId, parentProjectId: projectId },
      include: { _count: { select: { sites: true, childProjects: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(subProjects);
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

    const parentProject = await resolveParentProject(orgId, contractId, projectId);
    if (!parentProject) return apiError("NOT_FOUND", "Parent project not found.", 404);

    const body = createProjectSchema.parse(await req.json());

    const subProject = await prisma.project.create({
      data: {
        organizationId: orgId,
        contractId,
        parentProjectId: projectId,
        name: body.name,
        projectCode: body.projectCode ?? null,
        description: body.description ?? null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: body.status,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "project.created",
      resourceType: "project",
      resourceId: subProject.id,
      metadata: { name: subProject.name, parentProjectId: projectId, contractId },
    });

    return NextResponse.json(subProject, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
