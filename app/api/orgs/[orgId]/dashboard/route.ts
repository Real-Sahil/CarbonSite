export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";

const QuerySchema = z.object({
  periodId: z.string().optional(),
  snapshotId: z.string().optional(),
});

// GET /api/orgs/[orgId]/dashboard
// Returns pre-computed scope totals and category breakdown from DashboardAggregate.
// Accessible to all org members except field_worker (field workers see only their own submissions).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return json({ code: "VALIDATION_ERROR", message: "Invalid query parameters." }, { status: 422, version });
    }

    const { periodId, snapshotId } = parsed.data;

    // Resolve period — use provided periodId, or default to most recent.
    const period = periodId
      ? await prisma.reportingPeriod.findUnique({
          where: { id: periodId, organizationId: orgId },
          select: { id: true, label: true, startDate: true, endDate: true, status: true },
        })
      : await prisma.reportingPeriod.findFirst({
          where: { organizationId: orgId },
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
          select: { id: true, label: true, startDate: true, endDate: true, status: true },
        });

    if (!period) {
      return json({
        period: null,
        scopes: [],
        categories: [],
        facilities: [],
        recordCount: 0,
        approvedCount: 0,
        pendingReviewCount: 0,
        openReviewTaskCount: 0,
      }, { version });
    }

    const aggWhere = {
      organizationId: orgId,
      reportingPeriodId: period.id,
      // When snapshotId is provided restrict to that snapshot; otherwise use live (null snapshot).
      snapshotId: snapshotId ?? null,
    } as const;

    const [scopeAggs, categoryAggs, facilityAggs, recordCount, approvedCount, pendingReviewCount, openTaskCount] =
      await Promise.all([
        // Scope totals
        prisma.dashboardAggregate.groupBy({
          by: ["scope"],
          where: { ...aggWhere, emissionCategoryId: null, facilityId: null, businessUnitId: null },
          _sum: { totalCo2e: true, recordCount: true },
          orderBy: { scope: "asc" },
        }),

        // Category breakdown
        prisma.dashboardAggregate.findMany({
          where: { ...aggWhere, emissionCategoryId: { not: null }, facilityId: null, businessUnitId: null },
          include: { emissionCategory: { select: { code: true, name: true, scope: true } } },
          orderBy: { totalCo2e: "desc" },
        }),

        // Facility breakdown
        prisma.dashboardAggregate.findMany({
          where: { ...aggWhere, facilityId: { not: null }, emissionCategoryId: null, businessUnitId: null },
          include: { facility: { select: { name: true } } },
          orderBy: { totalCo2e: "desc" },
        }),

        // Activity record counts
        prisma.activityRecord.count({ where: { organizationId: orgId, reportingPeriodId: period.id } }),
        prisma.activityRecord.count({ where: { organizationId: orgId, reportingPeriodId: period.id, reviewStatus: "approved" } }),
        prisma.fieldSubmission.count({
          where: {
            organizationId: orgId,
            reportingPeriodId: period.id,
            status: { in: ["pending", "submitted", "under_review", "needs_info"] },
          },
        }),
        prisma.reviewTask.count({ where: { organizationId: orgId, status: "open" } }),
      ]);

    const grandCo2eKg = scopeAggs.reduce((sum, s) => sum + Number(s._sum.totalCo2e ?? 0), 0);

    return json({
      period: {
        id: period.id,
        label: period.label,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
      },
      snapshotId: snapshotId ?? null,
      grandTotalKg: grandCo2eKg,
      grandTotalTonnes: grandCo2eKg / 1000,
      scopes: scopeAggs.map((s) => ({
        scope: s.scope,
        totalKg: Number(s._sum.totalCo2e ?? 0),
        totalTonnes: Number(s._sum.totalCo2e ?? 0) / 1000,
        recordCount: s._sum.recordCount ?? 0,
      })),
      categories: categoryAggs
        .filter((a) => a.emissionCategory)
        .map((a) => ({
          code: a.emissionCategory!.code,
          name: a.emissionCategory!.name,
          scope: a.emissionCategory!.scope,
          totalKg: Number(a.totalCo2e),
          totalTonnes: Number(a.totalCo2e) / 1000,
          recordCount: a.recordCount,
        })),
      facilities: facilityAggs
        .filter((a) => a.facility)
        .map((a) => ({
          name: a.facility!.name,
          totalKg: Number(a.totalCo2e),
          totalTonnes: Number(a.totalCo2e) / 1000,
          recordCount: a.recordCount,
        })),
      recordCount,
      approvedCount,
      pendingReviewCount,
      openReviewTaskCount: openTaskCount,
    }, { version });
  } catch (err) {
    return handleRouteError(err);
  }
}
