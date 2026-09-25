export const dynamic = "force-dynamic";

import { requireFeature } from "@/lib/billing/limits";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateSvActivitySchema } from "@/lib/validation/org";
import { svRefsError } from "@/lib/social-value/refs";
import { Decimal } from "@prisma/client/runtime/library";

type RouteContext = { params: Promise<{ orgId: string; activityId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, activityId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders, "contract_manager");

    const activity = await prisma.svActivity.findUnique({
      where: { id: activityId },
      include: {
        commitment: { select: { id: true, title: true, status: true } },
        measure: { select: { id: true, name: true, unit: true } },
        facility: { select: { id: true, name: true } },
        reportingPeriod: { select: { id: true, label: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!activity || activity.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity not found.", 404);
    }

    return NextResponse.json(activity);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, activityId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor, "contract_manager");
    const planGate = await requireFeature(orgId, "socialValue");
    if (planGate) return planGate;

    const activity = await prisma.svActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity not found.", 404);
    }
    if (activity.status === "approved") {
      return apiError("CONFLICT", "Approved activities cannot be edited.", 409);
    }

    const body = updateSvActivitySchema.parse(await req.json());
    const refError = await svRefsError(orgId, {
      commitmentId: body.commitmentId,
      measureId: body.measureId,
      facilityId: body.facilityId,
      reportingPeriodId: body.reportingPeriodId,
    });
    if (refError) return apiError("NOT_FOUND", refError, 404);

    const updated = await prisma.svActivity.update({
      where: { id: activityId },
      data: {
        ...body,
        activityDate: body.activityDate ? new Date(body.activityDate) : undefined,
        quantityValue: body.quantityValue != null ? new Decimal(body.quantityValue) : undefined,
        monetisedValue: body.monetisedValue != null ? new Decimal(body.monetisedValue) : undefined,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_activity.update",
      resourceType: "SvActivity",
      resourceId: activityId,
      metadata: body,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, activityId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const activity = await prisma.svActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity not found.", 404);
    }
    if (activity.status === "approved") {
      return apiError("CONFLICT", "Approved activities cannot be deleted.", 409);
    }

    await prisma.svActivity.delete({ where: { id: activityId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_activity.delete",
      resourceType: "SvActivity",
      resourceId: activityId,
      metadata: { title: activity.title },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
