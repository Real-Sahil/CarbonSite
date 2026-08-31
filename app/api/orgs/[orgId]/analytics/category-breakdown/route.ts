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

    const rows = await prisma.$queryRaw<
      { name: string; code: string; scope: number; value: number }[]
    >`
      SELECT
        ec.name,
        ec.code,
        ec.scope,
        COALESCE(SUM(calc.total_co2e), 0)::float AS value
      FROM emission_calculations calc
      JOIN activity_records ar ON ar.id = calc.activity_record_id
      JOIN emission_categories ec ON ec.id = ar.emission_category_id
      WHERE calc.organization_id = ${orgId}
      GROUP BY ec.id, ec.name, ec.code, ec.scope
      ORDER BY value DESC
    `;

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
