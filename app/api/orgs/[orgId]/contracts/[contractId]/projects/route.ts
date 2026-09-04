export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createProjectSchema } from "@/lib/validation/project-carbon";

type Params = { params: Promise<{ orgId: string; contractId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const contract = await prisma.contract.findFirst({ where: { id: contractId, organizationId: orgId } });
    if (!contract) return apiError("NOT_FOUND", "Contract not found.", 404);

    const projects = await prisma.project.findMany({
      where: { contractId, organizationId: orgId },
      include: { _count: { select: { sites: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ projects });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);

    const contract = await prisma.contract.findFirst({ where: { id: contractId, organizationId: orgId } });
    if (!contract) return apiError("NOT_FOUND", "Contract not found.", 404);

    const body = await req.json().catch(() => null);
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid project data.", 400, parsed.error.flatten());
    }
    const data = parsed.data;

    const project = await prisma.project.create({
      data: {
        organizationId: orgId,
        contractId,
        name: data.name,
        projectCode: data.projectCode,
        description: data.description,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "project.created",
      resourceType: "Project",
      resourceId: project.id,
      metadata: { contractId, name: project.name },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
