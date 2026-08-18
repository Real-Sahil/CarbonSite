export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError } from "@/lib/validation/api";
import { createContractSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager",
      "operations_manager", "editor", "reviewer", "viewer", "auditor",
      "contract_manager", "project_manager", "client_viewer",
    );

    const contracts = await prisma.contract.findMany({
      where: { organizationId: orgId },
      include: {
        businessUnit: { select: { id: true, name: true } },
        _count: { select: { projects: true, socialValueRecords: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contracts);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "contract_manager",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "contracts-create", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createContractSchema.parse(await req.json());

    const contract = await prisma.contract.create({
      data: {
        organizationId: orgId,
        name: body.name,
        businessUnitId: body.businessUnitId ?? null,
        clientName: body.clientName ?? null,
        contractReference: body.contractReference ?? null,
        contractValue: body.contractValue ?? null,
        currency: body.currency,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        ppn0621Required: body.ppn0621Required,
        nhsEvergreenRequired: body.nhsEvergreenRequired,
        breeamRequired: body.breeamRequired,
        status: body.status,
        notes: body.notes ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "contract.created",
      resourceType: "contract",
      resourceId: contract.id,
      metadata: { name: contract.name, status: contract.status },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
