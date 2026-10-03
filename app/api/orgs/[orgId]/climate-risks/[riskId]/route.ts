export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { riskBody } from "@/lib/climate-disclosure/api";

type Ctx = { params: Promise<{ orgId: string; riskId: string }> };

// PATCH /api/orgs/[orgId]/climate-risks/[riskId]
// The whole risk is sent again; the organisation is part of every lookup, so
// another organisation's risk id is simply not found.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, riskId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = riskBody.parse(await req.json());

    const found = await prisma.climateRisk.updateMany({
      where: { id: riskId, organizationId: orgId },
      data: { ...body, updatedByUserId: session.user.id },
    });
    if (found.count === 0) return apiError("NOT_FOUND", "Risk not found.", 404);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "climate_risk.updated",
      resourceType: "ClimateRisk",
      resourceId: riskId,
      metadata: { kind: body.kind, status: body.status },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/orgs/[orgId]/climate-risks/[riskId]
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, riskId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const gone = await prisma.climateRisk.deleteMany({ where: { id: riskId, organizationId: orgId } });
    if (gone.count === 0) return apiError("NOT_FOUND", "Risk not found.", 404);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "climate_risk.deleted",
      resourceType: "ClimateRisk",
      resourceId: riskId,
      metadata: {},
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
