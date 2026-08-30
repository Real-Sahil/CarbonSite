import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";

interface Params {
  params: Promise<{ orgId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const days = parseInt(req.nextUrl.searchParams.get("days") || "30");

    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get latest calculation run
    const latestRun = await prisma.calculationRun.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!latestRun) {
      return NextResponse.json({ data: [] });
    }

    // Raw SQL query to get emissions by date
    const result = await prisma.$queryRaw<Array<{ date: string; total: bigint }>>`
      SELECT
        CAST(ar.activity_date AS VARCHAR) as date,
        SUM(CAST(em.total_co2e AS BIGINT)) as total
      FROM emission_calculations em
      JOIN activity_records ar ON em.activity_record_id = ar.id
      WHERE em.organization_id = ${orgId}
      AND em.calculation_run_id = ${latestRun.id}
      AND ar.activity_date >= ${startDate.toISOString().split('T')[0]}::date
      GROUP BY ar.activity_date
      ORDER BY ar.activity_date ASC
    `;

    const data = result.map((item) => ({
      date: item.date,
      totalCo2e: Number(item.total || 0) / 1000000, // Convert from smallest unit
    }));

    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}
