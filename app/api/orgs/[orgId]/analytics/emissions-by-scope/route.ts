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

    // Use DashboardAggregate — pre-computed totals per scope.
    // Join to the latest published snapshot so recalculations don't double-count.
    const latestSnapshot = await prisma.publishedSnapshot.findFirst({
      where: { organizationId: orgId },
      orderBy: { publishedAt: "desc" },
      select: { id: true },
    });

    const aggregates = await prisma.dashboardAggregate.groupBy({
      by: ["scope"],
      where: {
        organizationId: orgId,
        ...(latestSnapshot ? { snapshotId: latestSnapshot.id } : {}),
        emissionCategoryId: null,
        facilityId: null,
        businessUnitId: null,
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
