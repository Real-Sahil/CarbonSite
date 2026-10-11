export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { SCOPE_ROLLUP_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import { loadAnalyticsPeriod } from "@/lib/analytics/period";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    // Same rows the dashboard reads: live aggregates of the latest period, rollup rows only,
    // location-based Scope 2 (aggregate-filters.ts says why each pin is needed).
    const period = await loadAnalyticsPeriod(orgId);
    if (!period) return NextResponse.json({ data: [] });

    const aggregates = await prisma.dashboardAggregate.groupBy({
      by: ["scope"],
      where: {
        organizationId: orgId,
        reportingPeriodId: period.id,
        snapshotId: null,
        ...SCOPE_ROLLUP_DIMENSIONS,
        facilityId: null,
      },
      _sum: { totalCo2e: true },
      orderBy: { scope: "asc" },
    });

    const scopeNames: Record<number, string> = { 1: "Scope 1", 2: "Scope 2", 3: "Scope 3" };
    const rows = aggregates.map((a) => ({
      scope: a.scope,
      name: scopeNames[a.scope] ?? `Scope ${a.scope}`,
      // totalCo2e stored in kg — return kg, let the UI convert to tCO2e (÷1000)
      value: Number(a._sum.totalCo2e ?? 0),
    }));

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
