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

    const categories = await prisma.emissionCalculation.groupBy({
      by: ["emissionCategoryId"],
      where: {
        organizationId: orgId,
      },
      _sum: {
        totalCo2e: true,
      },
      orderBy: {
        _sum: {
          totalCo2e: "desc",
        },
      },
    });

    // Get category names
    const categoryIds = categories.map((c) => c.emissionCategoryId);
    const categoryNames = await prisma.emissionCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    const nameMap = new Map(categoryNames.map((c) => [c.id, c.name]));

    const data = categories.map((item) => ({
      categoryId: item.emissionCategoryId,
      name: nameMap.get(item.emissionCategoryId) || "Unknown",
      value: item._sum.totalCo2e ?? 0,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}
