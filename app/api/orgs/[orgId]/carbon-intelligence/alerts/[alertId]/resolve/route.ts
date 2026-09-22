export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

type RouteContext = { params: Promise<{ orgId: string; alertId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, alertId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager");

    const alert = await prisma.impactAlert.findUnique({ where: { id: alertId } });
    if (!alert || alert.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Alert not found.", 404);
    }
    if (alert.resolvedAt) {
      return apiError("CONFLICT", "Alert already resolved.", 409);
    }

    const updated = await prisma.impactAlert.update({
      where: { id: alertId },
      data: {
        resolvedAt: new Date(),
        resolvedByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "impact_alert.resolved",
      resourceType: "ImpactAlert",
      resourceId: alertId,
      metadata: { alertType: alert.alertType, title: alert.title },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
