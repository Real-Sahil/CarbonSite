export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { requireFeature } from "@/lib/billing/limits";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { obligationBody, obligationData, obligationRefsError } from "@/lib/social-value/obligations-api";

type Ctx = { params: Promise<{ orgId: string; obligationId: string }> };
const WRITERS = ["admin", "sustainability_director", "sustainability_manager", "contract_manager"] as const;

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, obligationId } = await params;
    const { session } = await requireOrgMember(orgId, ...WRITERS);
    const planGate = await requireFeature(orgId, "socialValue");
    if (planGate) return planGate;

    const body = obligationBody.partial().parse(await req.json());
    const refError = await obligationRefsError(orgId, body);
    if (refError) return apiError("NOT_FOUND", refError, 404);

    const updated = await prisma.svPlanningObligation.updateMany({
      where: { id: obligationId, organizationId: orgId },
      data: obligationData(body),
    });
    if (updated.count === 0) return apiError("NOT_FOUND", "Obligation not found.", 404);
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_planning_obligation.update",
      resourceType: "SvPlanningObligation",
      resourceId: obligationId,
      metadata: { fields: Object.keys(body) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, obligationId } = await params;
    const { session } = await requireOrgMember(orgId, ...WRITERS);
    const removed = await prisma.svPlanningObligation.deleteMany({ where: { id: obligationId, organizationId: orgId } });
    if (removed.count === 0) return apiError("NOT_FOUND", "Obligation not found.", 404);
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_planning_obligation.delete",
      resourceType: "SvPlanningObligation",
      resourceId: obligationId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
