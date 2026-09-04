export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateContractSchema } from "@/lib/validation/project-carbon";

type Params = { params: Promise<{ orgId: string; contractId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: orgId },
      include: { _count: { select: { projects: true } } },
    });
    if (!contract) return apiError("NOT_FOUND", "Contract not found.", 404);

    return NextResponse.json({ contract });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.contractManagers);

    const existing = await prisma.contract.findFirst({ where: { id: contractId, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", "Contract not found.", 404);

    const body = await req.json().catch(() => null);
    const parsed = updateContractSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid contract data.", 400, parsed.error.flatten());
    }

    const contract = await prisma.contract.update({
      where: { id: contractId },
      data: parsed.data,
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "contract.updated",
      resourceType: "Contract",
      resourceId: contractId,
      metadata: { changes: parsed.data },
    });

    return NextResponse.json({ contract });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.contractManagers);

    const existing = await prisma.contract.findFirst({ where: { id: contractId, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", "Contract not found.", 404);

    await prisma.contract.delete({ where: { id: contractId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "contract.deleted",
      resourceType: "Contract",
      resourceId: contractId,
      metadata: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
