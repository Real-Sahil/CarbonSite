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

    const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);
    const clampedDays = Math.min(Math.max(days, 1), 365);

    const rows = await prisma.$queryRaw<
      { date: string; totalCo2e: number }[]
    >`
      SELECT
        DATE(calc.created_at)::text AS date,
        COALESCE(SUM(calc.total_co2e), 0)::float AS "totalCo2e"
      FROM emission_calculations calc
      WHERE calc.organization_id = ${orgId}
        AND calc.created_at >= NOW() - INTERVAL '1 day' * ${clampedDays}
      GROUP BY DATE(calc.created_at)
      ORDER BY DATE(calc.created_at)
    `;

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
