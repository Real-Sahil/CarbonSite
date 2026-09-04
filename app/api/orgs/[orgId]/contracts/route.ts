export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createContractSchema } from "@/lib/validation/project-carbon";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const contracts = await prisma.contract.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { projects: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ contracts });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.contractManagers);

    const body = await req.json().catch(() => null);
    const parsed = createContractSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid contract data.", 400, parsed.error.flatten());
    }
    const data = parsed.data;

    const contract = await prisma.contract.create({
      data: {
        organizationId: orgId,
        name: data.name,
        clientName: data.clientName,
        contractReference: data.contractReference,
        contractValue: data.contractValue,
        currency: data.currency,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        ppn0621Required: data.ppn0621Required,
        nhsEvergreenRequired: data.nhsEvergreenRequired,
        breeamRequired: data.breeamRequired,
        notes: data.notes,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "contract.created",
      resourceType: "Contract",
      resourceId: contract.id,
      metadata: { name: contract.name, status: contract.status },
    });

    return NextResponse.json({ contract }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
