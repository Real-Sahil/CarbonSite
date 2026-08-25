import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        industry: true,
        hqCountry: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get current organization's emissions by category
    const orgByCategory = await prisma.dashboardAggregate.groupBy({
      by: ["emissionCategoryId"],
      where: {
        organizationId: orgId,
      },
      _sum: {
        totalCo2e: true,
      },
    });

    // Get category names
    const categoryMap = new Map<string, { name: string; code: string }>();
    for (const item of orgByCategory) {
      if (item.emissionCategoryId) {
        const category = await prisma.emissionCategory.findUnique({
          where: { id: item.emissionCategoryId },
          select: { name: true, code: true },
        });
        if (category) {
          categoryMap.set(item.emissionCategoryId, category);
        }
      }
    }

    // Find peer organizations
    const peers = await prisma.organization.findMany({
      where: {
        id: { not: orgId },
        industry: org.industry,
        hqCountry: org.hqCountry,
      },
      select: { id: true },
    });

    // Compare by category
    const categoryComparisons = [];

    for (const orgItem of orgByCategory) {
      if (!orgItem.emissionCategoryId) continue;

      const categoryInfo = categoryMap.get(orgItem.emissionCategoryId);
      if (!categoryInfo) continue;

      const orgEmissions = Number(orgItem._sum.totalCo2e ?? 0);

      // Get peer emissions for this category
      const peerEmissions = await prisma.dashboardAggregate.groupBy({
        by: ["organizationId"],
        where: {
          organizationId: { in: peers.map((p) => p.id) },
          emissionCategoryId: orgItem.emissionCategoryId,
        },
        _sum: {
          totalCo2e: true,
        },
      });

      const peerValues = peerEmissions
        .map((p) => Number(p._sum.totalCo2e ?? 0))
        .sort((a, b) => a - b);

      const avgPeerEmissions =
        peerValues.length > 0 ? peerValues.reduce((a, b) => a + b, 0) / peerValues.length : 0;

      const medianPeerEmissions =
        peerValues.length > 0
          ? peerValues.length % 2 === 0
            ? (peerValues[peerValues.length / 2 - 1] + peerValues[peerValues.length / 2]) / 2
            : peerValues[Math.floor(peerValues.length / 2)]
          : 0;

      const percentile = peerValues.length > 0
        ? (peerValues.filter((v) => v < orgEmissions).length / peerValues.length) * 100
        : 50;

      categoryComparisons.push({
        category: categoryInfo.name,
        code: categoryInfo.code,
        orgEmissions: Math.round(orgEmissions),
        peerAvg: Math.round(avgPeerEmissions),
        peerMedian: Math.round(medianPeerEmissions),
        peerMin: Math.round(peerValues[0] ?? 0),
        peerMax: Math.round(peerValues[peerValues.length - 1] ?? 0),
        percentile: Math.round(percentile),
        status: percentile < 33 ? "above_average" : percentile < 66 ? "average" : "below_average",
      });
    }

    return NextResponse.json({
      organization: { id: orgId },
      peerCount: peers.length,
      categoryComparisons: categoryComparisons.sort((a, b) => b.orgEmissions - a.orgEmissions),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
