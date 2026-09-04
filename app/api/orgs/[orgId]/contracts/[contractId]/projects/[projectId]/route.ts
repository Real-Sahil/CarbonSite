export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateProjectSchema } from "@/lib/validation/project-carbon";

type Params = { params: Promise<{ orgId: string; contractId: string; projectId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const project = await prisma.project.findFirst({
      where: { id: projectId, contractId, organizationId: orgId },
      include: { _count: { select: { sites: true } } },
    });
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    return NextResponse.json({ project });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);

    const existing = await prisma.project.findFirst({ where: { id: projectId, contractId, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", "Project not found.", 404);

    const body = await req.json().catch(() => null);
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid project data.", 400, parsed.error.flatten());
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: parsed.data,
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "project.updated",
      resourceType: "Project",
      resourceId: projectId,
      metadata: { changes: parsed.data },
    });

    return NextResponse.json({ project });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);

    const existing = await prisma.project.findFirst({ where: { id: projectId, contractId, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", "Project not found.", 404);

    await prisma.project.delete({ where: { id: projectId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "project.deleted",
      resourceType: "Project",
      resourceId: projectId,
      metadata: { contractId, name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
