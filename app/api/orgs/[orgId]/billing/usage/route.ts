export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { getUsageSummary } from "@/lib/billing/usage";
import { getLimits } from "@/lib/billing/limits";

// GET /api/orgs/[orgId]/billing/usage
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin");

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { plan: true, billingSubscription: true },
    });

    const sub = org.billingSubscription;
    const now = new Date();
    const periodStart = sub?.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = sub?.currentPeriodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [usageTotals, memberCount, facilityCount] = await Promise.all([
      getUsageSummary(orgId, periodStart, periodEnd),
      prisma.organizationMembership.count({ where: { organizationId: orgId } }),
      prisma.facility.count({ where: { organizationId: orgId } }),
    ]);

    const limits = getLimits(org.plan);

    return NextResponse.json({
      plan: org.plan,
      subscription: sub
        ? {
            status: sub.status,
            trialEndsAt: sub.trialEndsAt,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
          }
        : null,
      usage: {
        ...usageTotals,
        members: memberCount,
        facilities: facilityCount,
      },
      limits: {
        fieldSubmissionsPerMonth: limits.fieldSubmissionsPerMonth,
        reportsPerMonth: limits.reportsPerMonth,
        importsPerMonth: limits.importsPerMonth,
        calculationRunsPerMonth: limits.calculationRunsPerMonth,
        apiRequestsPerMonth: limits.apiRequestsPerMonth,
        members: limits.members,
        facilities: limits.facilities,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
