import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createProjectSchema } from "@/lib/validation/org";

async function resolveContract(orgId: string, contractId: string) {
  const c = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!c || c.organizationId !== orgId) return null;
  return c;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string }> },
) {
  try {
    const { orgId, contractId } = await params;
    await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager",
      "operations_manager", "editor", "reviewer", "viewer", "auditor",
      "contract_manager", "project_manager", "client_viewer",
    );

    const contract = await resolveContract(orgId, contractId);
    if (!contract) return apiError("NOT_FOUND", "Contract not found.", 404);

    const projects = await prisma.project.findMany({
      where: { organizationId: orgId, contractId },
      include: { _count: { select: { sites: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string }> },
) {
  try {
    const { orgId, contractId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "contract_manager", "project_manager",
    );
    const limited = rateLimitRequest(req, {
      key: rateLimitKey(orgId, "projects-create", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const contract = await resolveContract(orgId, contractId);
    if (!contract) return apiError("NOT_FOUND", "Contract not found.", 404);

    const body = createProjectSchema.parse(await req.json());

    const project = await prisma.project.create({
      data: {
        organizationId: orgId,
        contractId,
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
      resourceId: project.id,
      metadata: { name: project.name, contractId },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
