import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";

interface Params {
  params: Promise<{ orgId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
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

    // Raw SQL query to get emissions by category
    const result = await prisma.$queryRaw<Array<{ category_id: string; category_name: string; total: bigint }>>`
      SELECT ec.id as category_id, ec.name as category_name, SUM(CAST(em.total_co2e AS BIGINT)) as total
      FROM emission_calculations em
      JOIN activity_records ar ON em.activity_record_id = ar.id
      JOIN emission_categories ec ON ar.emission_category_id = ec.id
      WHERE em.organization_id = ${orgId}
      AND em.calculation_run_id = ${latestRun.id}
      GROUP BY ec.id, ec.name
      ORDER BY total DESC
    `;

    const data = result.map((item) => ({
      categoryId: item.category_id,
      name: item.category_name,
      value: Number(item.total || 0) / 1000000, // Convert from smallest unit
    }));

    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}
