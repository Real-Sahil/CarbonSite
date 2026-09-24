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

    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10),
      50
    );

    const latestSnapshot = await prisma.publishedSnapshot.findFirst({
      where: { organizationId: orgId },
      orderBy: { publishedAt: "desc" },
      select: { id: true },
    });

    const aggregates = await prisma.dashboardAggregate.findMany({
      where: {
        organizationId: orgId,
        ...(latestSnapshot ? { snapshotId: latestSnapshot.id } : {}),
        facilityId: { not: null },
        emissionCategoryId: null,
        businessUnitId: null,
      },
      select: {
        totalCo2e: true,
        facility: { select: { id: true, name: true } },
      },
      orderBy: { totalCo2e: "desc" },
      take: limit,
    });

    const rows = aggregates
      .filter((a) => a.facility)
      .map((a) => ({
        id: a.facility!.id,
        name: a.facility!.name,
        // totalCo2e in kg — UI divides by 1000 for tCO2e
        totalCo2e: Number(a.totalCo2e),
      }));

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
