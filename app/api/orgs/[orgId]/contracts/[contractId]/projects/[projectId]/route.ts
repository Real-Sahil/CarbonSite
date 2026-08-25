export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateProjectSchema } from "@/lib/validation/org";

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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sites: { orderBy: { name: "asc" } },
        _count: { select: { sites: true } },
      },
    });

    if (!project || project.organizationId !== orgId || project.contractId !== contractId) {
      return apiError("NOT_FOUND", "Project not found.", 404);
    }

    return NextResponse.json(project);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string; projectId: string }> },
) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "contract_manager", "project_manager",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "projects-update", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const existing = await resolveProject(orgId, contractId, projectId);
    if (!existing) return apiError("NOT_FOUND", "Project not found.", 404);

    const body = updateProjectSchema.parse(await req.json());

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: body.name,
        projectCode: body.projectCode ?? undefined,
        description: body.description ?? undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        status: body.status,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "project.updated",
      resourceType: "project",
      resourceId: projectId,
      metadata: { fields: Object.keys(body) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string; projectId: string }> },
) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "contract_manager",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "projects-delete", session.user.id),
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const existing = await resolveProject(orgId, contractId, projectId);
    if (!existing) return apiError("NOT_FOUND", "Project not found.", 404);

    await prisma.project.delete({ where: { id: projectId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "project.deleted",
      resourceType: "project",
      resourceId: projectId,
      metadata: { name: existing.name, contractId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
