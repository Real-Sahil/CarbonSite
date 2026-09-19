import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import {
  CATEGORY_BREAKDOWN_DIMENSIONS,
  PRIMARY_SCOPE2_METHOD,
} from "@/lib/calculation/aggregate-filters";

// With a cohort of one, peerAvg, peerMin and peerMax are all that tenant's exact
// figure, so a comparison is only returned above this floor.
const MIN_PEER_COHORT = 3;
const MAX_PEERS = 50;

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

    // Scope to one reporting period. Without this the groupBy sums every period
    // the org has ever reported, plus every published snapshot's frozen copy.
    const orgPeriod = await prisma.reportingPeriod.findFirst({
      where: { organizationId: orgId },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    if (!orgPeriod) {
      return NextResponse.json({
        organization: { id: orgId },
        peerCount: 0,
        categoryComparisons: [],
        message: "No reporting period to benchmark.",
      });
    }

    const orgByCategory = await prisma.dashboardAggregate.groupBy({
      by: ["emissionCategoryId"],
      where: {
        organizationId: orgId,
        reportingPeriodId: orgPeriod.id,
        snapshotId: null,
        ...CATEGORY_BREAKDOWN_DIMENSIONS,
      },
      _sum: {
        totalCo2e: true,
      },
    });

    const categoryIds = orgByCategory
      .map((item) => item.emissionCategoryId)
      .filter((id): id is string => id != null);

    const categories = await prisma.emissionCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, code: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Find peer organizations. Ids are used to query totals and never returned.
    const peers = await prisma.organization.findMany({
      where: {
        id: { not: orgId },
        industry: org.industry,
        hqCountry: org.hqCountry,
      },
      select: { id: true },
      take: MAX_PEERS,
    });

    // Each peer is compared on its own latest period, resolved once here rather
    // than per category.
    const peerLatestPeriods = await prisma.reportingPeriod.findMany({
      where: { organizationId: { in: peers.map((p) => p.id) } },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, organizationId: true },
    });
    const peerPeriodByOrg = new Map<string, string>();
    for (const period of peerLatestPeriods) {
      if (!peerPeriodByOrg.has(period.organizationId)) {
        peerPeriodByOrg.set(period.organizationId, period.id);
      }
    }
    const peerScope = Array.from(peerPeriodByOrg.entries()).map(
      ([organizationId, reportingPeriodId]) => ({ organizationId, reportingPeriodId }),
    );

    if (peerScope.length < MIN_PEER_COHORT) {
      return NextResponse.json({
        organization: { id: orgId },
        peerCount: peerScope.length,
        categoryComparisons: [],
        message: `Benchmarking needs at least ${MIN_PEER_COHORT} comparable organisations with a reporting period. ${peerScope.length} found.`,
      });
    }

    // Compare by category
    const categoryComparisons = [];

    for (const orgItem of orgByCategory) {
      if (!orgItem.emissionCategoryId) continue;

      const categoryInfo = categoryMap.get(orgItem.emissionCategoryId);
      if (!categoryInfo) continue;

      const orgEmissions = Number(orgItem._sum.totalCo2e ?? 0);

      // Get peer emissions for this category, each peer on its own latest period.
      const peerEmissions = await prisma.dashboardAggregate.groupBy({
        by: ["organizationId"],
        where: {
          // Both conditions are OR-shaped, so they nest under AND rather than
          // fighting over a single top-level `OR` key.
          AND: [{ OR: peerScope }, PRIMARY_SCOPE2_METHOD],
          snapshotId: null,
          emissionCategoryId: orgItem.emissionCategoryId,
          facilityId: null,
          businessUnitId: null,
        },
        _sum: {
          totalCo2e: true,
        },
      });

      const peerValues = peerEmissions
        .map((p) => Number(p._sum.totalCo2e ?? 0))
        .sort((a, b) => a - b);

      // The cohort floor has to hold per category, not just overall: a category
      // only one peer reports on would have peerAvg, peerMin and peerMax all
      // equal to that tenant's exact figure.
      if (peerValues.length < MIN_PEER_COHORT) continue;

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
      peerCount: peerScope.length,
      categoryComparisons: categoryComparisons.sort((a, b) => b.orgEmissions - a.orgEmissions),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
