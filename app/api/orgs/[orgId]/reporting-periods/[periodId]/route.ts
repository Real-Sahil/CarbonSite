import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateReportingPeriodSchema } from "@/lib/validation/org";

async function resolvePeriod(orgId: string, periodId: string) {
  const period = await prisma.reportingPeriod.findUnique({
    where: { id: periodId },
  });
  if (!period || period.organizationId !== orgId) {
    return null;
  }
  return period;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; periodId: string }> },
) {
  try {
    const { orgId, periodId } = await params;
    await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "viewer",
      "auditor",
      "field_worker",
    );

    const period = await resolvePeriod(orgId, periodId);
    if (!period) {
      return apiError("NOT_FOUND", "Reporting period not found.", 404);
    }

    return NextResponse.json(period);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; periodId: string }> },
) {
  try {
    const { orgId, periodId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "reporting-period-update", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const period = await resolvePeriod(orgId, periodId);
    if (!period) {
      return apiError("NOT_FOUND", "Reporting period not found.", 404);
    }

    // Cannot unlock a locked period
    if (period.status === "locked") {
      return apiError(
        "PERIOD_LOCKED",
        "This reporting period is locked and cannot be modified.",
        409,
      );
    }

    const body = updateReportingPeriodSchema.parse(await req.json());

    // Validate date range if both dates provided
    if (body.startDate !== undefined || body.endDate !== undefined) {
      const start = body.startDate ? new Date(body.startDate) : period.startDate;
      const end = body.endDate ? new Date(body.endDate) : period.endDate;
      if (start >= end) {
        return apiError("INVALID_DATE_RANGE", "startDate must be before endDate.", 422);
      }
    }

    const updated = await prisma.reportingPeriod.update({
      where: { id: periodId },
      data: {
        ...(body.label !== undefined && { label: body.label }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.startDate !== undefined && { startDate: new Date(body.startDate) }),
        ...(body.endDate !== undefined && { endDate: new Date(body.endDate) }),
        ...(body.status !== undefined && { status: body.status }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "reporting_period.updated",
      resourceType: "reporting_period",
      resourceId: periodId,
      metadata: { changes: body },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
