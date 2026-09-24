export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { createImpactAlertSchema } from "@/lib/validation/org";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const { searchParams } = new URL(req.url);
    const alertType = searchParams.get("alertType") ?? undefined;
    const severity = searchParams.get("severity") ?? undefined;
    const resolved = searchParams.get("resolved");
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

    const isResolved =
      resolved === "true" ? true : resolved === "false" ? false : undefined;

    const alerts = await prisma.impactAlert.findMany({
      where: {
        organizationId: orgId,
        ...(alertType && { alertType }),
        ...(severity && { severity }),
        ...(isResolved !== undefined && {
          resolvedAt: isResolved ? { not: null } : null,
        }),
      },
      include: {
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = alerts.length > limit;
    const items = hasMore ? alerts.slice(0, limit) : alerts;

    return NextResponse.json({
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager");

    const body = createImpactAlertSchema.parse(await req.json());

    const alert = await prisma.impactAlert.create({
      data: {
        organizationId: orgId,
        alertType: body.alertType,
        severity: body.severity,
        title: body.title,
        message: body.message,
        resourceType: body.resourceType ?? null,
        resourceId: body.resourceId ?? null,
        metadata: (body.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "impact_alert.created",
      resourceType: "ImpactAlert",
      resourceId: alert.id,
      metadata: { alertType: body.alertType, severity: body.severity, title: body.title },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
