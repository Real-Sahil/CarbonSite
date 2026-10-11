export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { CATEGORY_BREAKDOWN_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import { loadAnalyticsPeriod } from "@/lib/analytics/period";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const period = await loadAnalyticsPeriod(orgId);
    if (!period) return NextResponse.json({ data: [] });

    const aggregates = await prisma.dashboardAggregate.findMany({
      where: {
        organizationId: orgId,
        reportingPeriodId: period.id,
        snapshotId: null,
        ...CATEGORY_BREAKDOWN_DIMENSIONS,
      },
      select: {
        scope: true,
        totalCo2e: true,
        emissionCategory: { select: { name: true, code: true, scope: true } },
      },
      orderBy: { totalCo2e: "desc" },
    });

    const rows = aggregates
      .filter((a) => a.emissionCategory)
      .map((a) => ({
        name: a.emissionCategory!.name,
        code: a.emissionCategory!.code,
        scope: a.scope,
        // totalCo2e in kg — UI divides by 1000 for tCO2e
        value: Number(a.totalCo2e),
      }));

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
