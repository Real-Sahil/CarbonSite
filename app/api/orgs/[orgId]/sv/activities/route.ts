export const dynamic = "force-dynamic";

import { requireFeature } from "@/lib/billing/limits";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createSvActivitySchema } from "@/lib/validation/org";
import { Decimal } from "@prisma/client/runtime/library";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders, "contract_manager");

    const { searchParams } = new URL(req.url);
    const commitmentId = searchParams.get("commitmentId") ?? undefined;
    const facilityId = searchParams.get("facilityId") ?? undefined;
    const reportingPeriodId = searchParams.get("reportingPeriodId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

    const activities = await prisma.svActivity.findMany({
      where: {
        organizationId: orgId,
        ...(commitmentId && { commitmentId }),
        ...(facilityId && { facilityId }),
        ...(reportingPeriodId && { reportingPeriodId }),
        ...(status && { status: status as never }),
      },
      include: {
        commitment: { select: { id: true, title: true } },
        measure: { select: { id: true, name: true, unit: true } },
        facility: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { activityDate: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = activities.length > limit;
    const data = hasMore ? activities.slice(0, limit) : activities;

    return NextResponse.json({
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
    });
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
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor, "contract_manager");
    const planGate = await requireFeature(orgId, "socialValue");
    if (planGate) return planGate;
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-activities-create", session.user.id),
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createSvActivitySchema.parse(await req.json());

    if (body.commitmentId) {
      const commitment = await prisma.svCommitment.findUnique({ where: { id: body.commitmentId } });
      if (!commitment || commitment.organizationId !== orgId) {
        return apiError("NOT_FOUND", "Commitment not found.", 404);
      }
    }
    if (body.facilityId) {
      const facility = await prisma.facility.findUnique({ where: { id: body.facilityId } });
      if (!facility || facility.organizationId !== orgId) {
        return apiError("NOT_FOUND", "Facility not found.", 404);
      }
    }

    const activity = await prisma.svActivity.create({
      data: {
        organizationId: orgId,
        commitmentId: body.commitmentId,
        measureId: body.measureId,
        facilityId: body.facilityId,
        reportingPeriodId: body.reportingPeriodId,
        submittedByUserId: session.user.id,
        title: body.title,
        description: body.description,
        activityDate: new Date(body.activityDate),
        quantityValue: body.quantityValue != null ? new Decimal(body.quantityValue) : undefined,
        quantityUnit: body.quantityUnit,
        monetisedValue: body.monetisedValue != null ? new Decimal(body.monetisedValue) : undefined,
        currency: body.currency ?? "GBP",
        evidenceUrls: body.evidenceUrls ?? [],
        status: "submitted",
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_activity.create",
      resourceType: "SvActivity",
      resourceId: activity.id,
      metadata: { title: body.title, commitmentId: body.commitmentId },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
