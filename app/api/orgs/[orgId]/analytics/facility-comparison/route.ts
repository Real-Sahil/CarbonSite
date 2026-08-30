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

    const facilities = await prisma.emissionCalculation.groupBy({
      by: ["facilityId"],
      where: {
        organizationId: orgId,
        facilityId: { not: null },
      },
      _sum: {
        totalCo2e: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          totalCo2e: "desc",
        },
      },
      take: limit,
    });

    // Get facility names
    const facilityIds = facilities
      .map((f) => f.facilityId)
      .filter((id) => id !== null) as string[];

    const facilityNames = await prisma.facility.findMany({
      where: { id: { in: facilityIds } },
      select: { id: true, name: true },
    });

    const nameMap = new Map(facilityNames.map((f) => [f.id, f.name]));

    const data = facilities.map((item) => ({
      facilityId: item.facilityId,
      name: nameMap.get(item.facilityId) || "Unknown",
      totalCo2e: item._sum.totalCo2e ?? 0,
      recordCount: item._count.id,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}
