export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createBaseYearSchema } from "@/lib/validation/inventory";
import { computePeriodTotals } from "@/lib/inventory/base-year";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const baseYears = await prisma.baseYear.findMany({
      where: { organizationId: orgId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        reportingPeriod: { select: { id: true, label: true, startDate: true, endDate: true } },
        createdBy: { select: { name: true, email: true } },
        _count: { select: { recalculations: true } },
      },
    });

    return Response.json({
      data: baseYears.map((by) => ({
        ...by,
        significanceThresholdPercent: Number(by.significanceThresholdPercent),
        originalTotalCo2e: by.originalTotalCo2e === null ? null : Number(by.originalTotalCo2e),
        currentTotalCo2e: by.currentTotalCo2e === null ? null : Number(by.currentTotalCo2e),
        // Cumulative drift from what was first published, the figure a reader
        // of a multi-year trend needs in order to trust the series.
        cumulativeDriftPercent:
          by.originalTotalCo2e && Number(by.originalTotalCo2e) !== 0
            ? ((Number(by.currentTotalCo2e ?? 0) - Number(by.originalTotalCo2e)) /
                Number(by.originalTotalCo2e)) *
              100
            : null,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "base-years", session.user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createBaseYearSchema.parse(await req.json());

    const period = await prisma.reportingPeriod.findFirst({
      where: { id: body.reportingPeriodId, organizationId: orgId },
      select: { id: true },
    });
    if (!period) {
      return apiError("NOT_FOUND", "Reporting period not found in this organisation.", 404);
    }

    // Freeze the totals as they stand at the moment the base year is declared.
    // These originals are never rewritten, so the platform can always show what
    // was first published alongside what the figure has since become.
    const totals = await computePeriodTotals(orgId, body.reportingPeriodId);

    const baseYear = await prisma.baseYear.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        label: body.label,
        rationale: body.rationale ?? null,
        significanceThresholdPercent: body.significanceThresholdPercent,
        status: "draft",
        originalScope1Co2e: totals.scope1,
        originalScope2Co2e: totals.scope2,
        originalScope3Co2e: totals.scope3,
        originalTotalCo2e: totals.total,
        currentScope1Co2e: totals.scope1,
        currentScope2Co2e: totals.scope2,
        currentScope3Co2e: totals.scope3,
        currentTotalCo2e: totals.total,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "base_year.created",
      resourceType: "BaseYear",
      resourceId: baseYear.id,
      metadata: {
        label: baseYear.label,
        reportingPeriodId: baseYear.reportingPeriodId,
        frozenTotalCo2e: totals.total,
        significanceThresholdPercent: body.significanceThresholdPercent,
      },
    });

    return Response.json(baseYear, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
