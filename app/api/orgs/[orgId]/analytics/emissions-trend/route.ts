export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { loadAnalyticsPeriod, parseTrendDays, trendWindowStart } from "@/lib/analytics/period";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    // The dashboard's period, not "the last N days from today": a period that ended
    // months ago still has a trend. `days` narrows it to the last N days of the period.
    const period = await loadAnalyticsPeriod(orgId);
    if (!period) return NextResponse.json({ data: [] });

    // Latest succeeded run of that period, so recalculations are not double counted.
    const latestRun = await prisma.calculationRun.findFirst({
      where: { organizationId: orgId, reportingPeriodId: period.id, status: "succeeded" },
      orderBy: { finishedAt: "desc" },
      select: { id: true },
    });
    if (!latestRun) return NextResponse.json({ data: [] });

    const from = trendWindowStart(period, parseTrendDays(req.nextUrl.searchParams.get("days")));

    // Group by activity_date (when the activity occurred) — not calc.created_at (when calc ran).
    // Market-based Scope 2 is left out: the headline inventory is location-based and the two
    // are never added (lib/calculation/scope2-method.ts).
    const rows = await prisma.$queryRaw<
      { date: string; totalCo2e: number }[]
    >`
      SELECT
        ar.activity_date::text AS date,
        COALESCE(SUM(calc.total_co2e), 0)::float AS "totalCo2e"
      FROM emission_calculations calc
      JOIN activity_records ar ON ar.id = calc.activity_record_id
      JOIN emission_categories ec ON ec.id = ar.emission_category_id
      WHERE calc.organization_id = ${orgId}
        AND calc.calculation_run_id = ${latestRun.id}
        AND ar.activity_date IS NOT NULL
        AND ar.activity_date >= ${from}::date
        AND ar.activity_date <= ${period.endDate}::date
        AND NOT (
          ec.scope = 2
          AND COALESCE(ar.scope2_method::text, CASE WHEN ec.code = 's2-electricity-mb' THEN 'market_based' ELSE 'location_based' END) = 'market_based'
        )
      GROUP BY ar.activity_date
      ORDER BY ar.activity_date
    `;

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
