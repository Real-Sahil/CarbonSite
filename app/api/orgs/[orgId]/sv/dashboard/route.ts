export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders, "contract_manager");

    const { searchParams } = new URL(req.url);
    const reportingPeriodId = searchParams.get("reportingPeriodId") ?? undefined;
    const contractId = searchParams.get("contractId") ?? undefined;

    const baseWhere = {
      organizationId: orgId,
      ...(reportingPeriodId && { reportingPeriodId }),
      ...(contractId && { commitment: { contractId } }),
    };

    const [
      commitmentCounts,
      activityCounts,
      monetisedAgg,
      recentActivities,
      commitmentsByStatus,
    ] = await Promise.all([
      // Commitment status breakdown
      prisma.svCommitment.groupBy({
        by: ["status"],
        where: { organizationId: orgId, ...(reportingPeriodId && { reportingPeriodId }), ...(contractId && { contractId }) },
        _count: { _all: true },
      }),

      // Activity status breakdown
      prisma.svActivity.groupBy({
        by: ["status"],
        where: { organizationId: orgId, ...(reportingPeriodId && { reportingPeriodId }) },
        _count: { _all: true },
      }),

      // Total monetised value of approved activities
      prisma.svActivity.aggregate({
        where: { organizationId: orgId, status: "approved", ...(reportingPeriodId && { reportingPeriodId }) },
        _sum: { monetisedValue: true },
        _count: { _all: true },
      }),

      // 5 most recent activities
      prisma.svActivity.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true, title: true, activityDate: true, status: true,
          monetisedValue: true, quantityValue: true, quantityUnit: true,
          commitment: { select: { id: true, title: true } },
        },
      }),

      // Active commitments with progress
      prisma.svCommitment.findMany({
        where: {
          organizationId: orgId,
          status: { in: ["active", "in_progress"] },
          ...(reportingPeriodId && { reportingPeriodId }),
          ...(contractId && { contractId }),
        },
        include: {
          _count: { select: { activities: true } },
          activities: {
            where: { status: "approved" },
            select: { monetisedValue: true, quantityValue: true },
          },
        },
        orderBy: { targetDate: "asc" },
        take: 10,
      }),
    ]);

    // Build commitment status map
    const commitmentStatusMap = Object.fromEntries(
      commitmentCounts.map((r) => [r.status, r._count._all]),
    );
    const activityStatusMap = Object.fromEntries(
      activityCounts.map((r) => [r.status, r._count._all]),
    );

    // Enrich commitments with progress %
    const commitmentsWithProgress = commitmentsByStatus.map((c) => {
      const approvedMonetised = c.activities.reduce(
        (sum, a) => sum + (a.monetisedValue ? Number(a.monetisedValue) : 0),
        0,
      );
      const progressPct =
        c.monetisedValue && Number(c.monetisedValue) > 0
          ? Math.min(100, Math.round((approvedMonetised / Number(c.monetisedValue)) * 100))
          : null;
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        targetValue: c.targetValue,
        targetUnit: c.targetUnit,
        targetDate: c.targetDate,
        monetisedTarget: c.monetisedValue,
        monetisedDelivered: approvedMonetised,
        progressPct,
        activityCount: c._count.activities,
      };
    });

    return NextResponse.json({
      commitments: commitmentStatusMap,
      activities: activityStatusMap,
      approvedMonetisedTotal: monetisedAgg._sum.monetisedValue ?? 0,
      approvedActivityCount: monetisedAgg._count._all,
      recentActivities,
      activeCommitments: commitmentsWithProgress,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
