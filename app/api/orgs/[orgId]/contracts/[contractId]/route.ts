import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateContractSchema } from "@/lib/validation/org";

async function resolveContract(orgId: string, contractId: string) {
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract || contract.organizationId !== orgId) return null;
  return contract;
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

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        businessUnit: { select: { id: true, name: true } },
        projects: {
          include: { _count: { select: { sites: true } } },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { socialValueRecords: true, reports: true } },
      },
    });

    if (!contract || contract.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Contract not found.", 404);
    }

    return NextResponse.json(contract);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string }> },
) {
  try {
    const { orgId, contractId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "contract_manager",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "contracts-update", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const existing = await resolveContract(orgId, contractId);
    if (!existing) return apiError("NOT_FOUND", "Contract not found.", 404);

    const body = updateContractSchema.parse(await req.json());

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        name: body.name,
        businessUnitId: body.businessUnitId ?? undefined,
        clientName: body.clientName ?? undefined,
        contractReference: body.contractReference ?? undefined,
        contractValue: body.contractValue ?? undefined,
        currency: body.currency,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        ppn0621Required: body.ppn0621Required,
        nhsEvergreenRequired: body.nhsEvergreenRequired,
        breeamRequired: body.breeamRequired,
        status: body.status,
        notes: body.notes ?? undefined,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "contract.updated",
      resourceType: "contract",
      resourceId: contractId,
      metadata: { fields: Object.keys(body) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; contractId: string }> },
) {
  try {
    const { orgId, contractId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "contracts-delete", session.user.id),
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const existing = await resolveContract(orgId, contractId);
    if (!existing) return apiError("NOT_FOUND", "Contract not found.", 404);

    await prisma.contract.delete({ where: { id: contractId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "contract.deleted",
      resourceType: "contract",
      resourceId: contractId,
      metadata: { name: existing.name },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
