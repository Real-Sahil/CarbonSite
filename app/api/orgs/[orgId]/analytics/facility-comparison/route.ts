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
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");

    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    // Get latest calculation run
    const latestRun = await prisma.calculationRun.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!latestRun) {
      return NextResponse.json({ data: [] });
    }

    // Raw SQL query to get emissions by facility
    const result = await prisma.$queryRaw<Array<{ facility_id: string; facility_name: string; total: bigint; record_count: bigint }>>`
      SELECT ar.facility_id, f.name as facility_name, SUM(CAST(em.total_co2e AS BIGINT)) as total, COUNT(em.id) as record_count
      FROM emission_calculations em
      JOIN activity_records ar ON em.activity_record_id = ar.id
      LEFT JOIN facilities f ON ar.facility_id = f.id
      WHERE em.organization_id = ${orgId}
      AND em.calculation_run_id = ${latestRun.id}
      AND ar.facility_id IS NOT NULL
      GROUP BY ar.facility_id, f.name
      ORDER BY total DESC
      LIMIT ${limit}
    `;

    const data = result.map((item) => ({
      facilityId: item.facility_id,
      name: item.facility_name || "Unknown",
      totalCo2e: Number(item.total || 0) / 1000000, // Convert from smallest unit
      recordCount: Number(item.record_count),
    }));

    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}
