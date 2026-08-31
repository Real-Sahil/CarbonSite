export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10),
      50
    );

    const rows = await prisma.$queryRaw<
      { id: string; name: string; totalCo2e: number }[]
    >`
      SELECT
        f.id,
        f.name,
        COALESCE(SUM(calc.total_co2e), 0)::float AS "totalCo2e"
      FROM emission_calculations calc
      JOIN activity_records ar ON ar.id = calc.activity_record_id
      JOIN facilities f ON f.id = ar.facility_id
      WHERE calc.organization_id = ${orgId}
        AND ar.facility_id IS NOT NULL
      GROUP BY f.id, f.name
      ORDER BY "totalCo2e" DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
