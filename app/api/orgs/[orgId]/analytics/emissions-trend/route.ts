export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);
    const clampedDays = Math.min(Math.max(days, 1), 365);

    // Find the latest published calculation run to avoid double-counting recalculations.
    const latestRun = await prisma.calculationRun.findFirst({
      where: { organizationId: orgId, status: "succeeded" },
      orderBy: { finishedAt: "desc" },
      select: { id: true },
    });

    if (!latestRun) {
      return NextResponse.json({ data: [] });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - clampedDays);

    // Group by activity_date (when the activity occurred) — not calc.created_at (when calc ran).
    const rows = await prisma.$queryRaw<
      { date: string; totalCo2e: number }[]
    >`
      SELECT
        ar.activity_date::text AS date,
        COALESCE(SUM(calc.total_co2e), 0)::float AS "totalCo2e"
      FROM emission_calculations calc
      JOIN activity_records ar ON ar.id = calc.activity_record_id
      WHERE calc.organization_id = ${orgId}
        AND calc.calculation_run_id = ${latestRun.id}
        AND ar.activity_date IS NOT NULL
        AND ar.activity_date >= ${cutoff}::date
      GROUP BY ar.activity_date
      ORDER BY ar.activity_date
    `;

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
