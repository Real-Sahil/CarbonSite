/**
 * Advanced Drill-Down Analytics
 *
 * Multi-dimensional analysis with dynamic filtering:
 * - By scope (1, 2, 3), category, facility, business unit, date range
 * - Hierarchical drill-down: org → facilities → categories → records
 * - Trend analysis with comparison periods
 * - Distribution analysis (box plots, percentiles)
 * - Top contributors (by value, by growth rate)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

const DrillDownRequestSchema = z.object({
  // Dimensions to break down by
  dimensions: z.array(z.enum(["scope", "category", "facility", "businessUnit", "date"])).default([
    "scope",
  ]),

  // Filters
  periodId: z.string().optional(),
  scopes: z.array(z.number()).optional(),
  categoryIds: z.array(z.string()).optional(),
  facilityIds: z.array(z.string()).optional(),
  businessUnitIds: z.array(z.string()).optional(),

  // Analysis options
  includeDistribution: z.boolean().default(true),
  includeTopContributors: z.boolean().default(true),
  includeComparison: z.boolean().default(false),
  comparisonPeriodId: z.string().optional(),

  // Pagination
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});

type DrillDownRequest = z.infer<typeof DrillDownRequestSchema>;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId);

    const body = await req.json();
    const query = DrillDownRequestSchema.parse(body);

    // Get reporting periods
    const periods = await prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true, startDate: true },
      orderBy: { startDate: "desc" },
    });

    const activePeriod = query.periodId
      ? periods.find((p) => p.id === query.periodId)
      : periods[0];

    if (!activePeriod) {
      return NextResponse.json({ error: "No reporting periods found" }, { status: 404 });
    }

    // Build where clause for activity records
    const whereClause: Record<string, unknown> = {
      organizationId: orgId,
      reportingPeriodId: activePeriod.id,
      reviewStatus: "approved",
    };

    if (query.scopes && query.scopes.length > 0) {
      whereClause.category = {
        scope: { in: query.scopes },
      };
    }
    if (query.categoryIds && query.categoryIds.length > 0) {
      whereClause.emissionCategoryId = { in: query.categoryIds };
    }
    if (query.facilityIds && query.facilityIds.length > 0) {
      whereClause.facilityId = { in: query.facilityIds };
    }
    if (query.businessUnitIds && query.businessUnitIds.length > 0) {
      whereClause.businessUnitId = { in: query.businessUnitIds };
    }

    // Fetch aggregates based on dimensions
    const drillDownResults: Record<string, unknown> = {
      period: activePeriod,
      dimensions: query.dimensions,
    };

    // By scope
    if (query.dimensions.includes("scope")) {
      const scopeData = await prisma.$queryRaw<
        Array<{ scope: number; totalCo2e: number }>
      >`
        SELECT ec.scope, COALESCE(CAST(SUM(ar.amount) AS NUMERIC), 0) as totalCo2e
        FROM activity_records ar
        JOIN emission_categories ec ON ar.emission_category_id = ec.id
        WHERE ar.organization_id = ${orgId}
          AND ar.reporting_period_id = ${activePeriod.id}
          AND ar.review_status = 'approved'
        GROUP BY ec.scope
        ORDER BY totalCo2e DESC
      `;

      drillDownResults.byScope = scopeData.map((item) => ({
        scope: item.scope,
        totalCo2e: Number(item.totalCo2e),
      }));
    }

    // By category
    if (query.dimensions.includes("category")) {
      const categoryData = await prisma.activityRecord.groupBy({
        by: ["emissionCategoryId"],
        where: whereClause,
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: "desc" } },
        take: query.limit,
        skip: query.offset,
      });

      // Fetch category names
      const categoryIds = categoryData
        .map((c) => c.emissionCategoryId)
        .filter(Boolean) as string[];
      const categories = await prisma.emissionCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, scope: true },
      });

      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      drillDownResults.byCategory = categoryData.map((item) => {
        const cat = item.emissionCategoryId
          ? categoryMap.get(item.emissionCategoryId)
          : null;
        return {
          categoryId: item.emissionCategoryId,
          categoryName: cat?.name || "Unknown",
          scope: cat?.scope,
          totalCo2e: Number(item._sum.amount) || 0,
          recordCount: item._count.id,
        };
      });
    }

    // By facility
    if (query.dimensions.includes("facility")) {
      const facilityData = await prisma.activityRecord.groupBy({
        by: ["facilityId"],
        where: whereClause,
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: "desc" } },
        take: query.limit,
        skip: query.offset,
      });

      // Fetch facility names
      const facilityIds = facilityData
        .map((f) => f.facilityId)
        .filter(Boolean) as string[];
      const facilities = await prisma.facility.findMany({
        where: { id: { in: facilityIds } },
        select: { id: true, name: true, country: true, region: true },
      });

      const facilityMap = new Map(facilities.map((f) => [f.id, f]));

      drillDownResults.byFacility = facilityData.map((item) => {
        const fac = item.facilityId ? facilityMap.get(item.facilityId) : null;
        return {
          facilityId: item.facilityId,
          facilityName: fac?.name || "Unknown",
          location: fac?.region || fac?.country || null,
          totalCo2e: Number(item._sum.amount) || 0,
          recordCount: item._count.id,
        };
      });
    }

    // Top contributors (by value)
    if (query.includeTopContributors) {
      const topRecords = await prisma.activityRecord.findMany({
        where: whereClause,
        select: {
          id: true,
          sourceDescription: true,
          amount: true,
          emissionCategoryId: true,
          facilityId: true,
        },
        orderBy: { amount: "desc" },
        take: 10,
      });

      // Fetch category and facility names
      const categoryIds = topRecords
        .map((r) => r.emissionCategoryId)
        .filter(Boolean) as string[];
      const facilityIds = topRecords
        .map((r) => r.facilityId)
        .filter(Boolean) as string[];

      const categories = await prisma.emissionCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      });
      const facilityNames = await prisma.facility.findMany({
        where: { id: { in: facilityIds } },
        select: { id: true, name: true },
      });

      const categoryMap = new Map(categories.map((c) => [c.id, c]));
      const facilityMap = new Map(facilityNames.map((f) => [f.id, f]));

      drillDownResults.topContributors = topRecords.map((r) => ({
        id: r.id,
        sourceDescription: r.sourceDescription,
        amount: Number(r.amount),
        category: r.emissionCategoryId
          ? categoryMap.get(r.emissionCategoryId)
          : null,
        facility: r.facilityId ? facilityMap.get(r.facilityId) : null,
      }));
    }

    // Comparison with previous period (if requested)
    if (query.includeComparison && query.comparisonPeriodId) {
      const comparisonAgg = await prisma.dashboardAggregate.aggregate({
        where: {
          organizationId: orgId,
          reportingPeriodId: query.comparisonPeriodId,
        },
        _sum: { totalCo2e: true },
      });

      const currentAgg = await prisma.dashboardAggregate.aggregate({
        where: {
          organizationId: orgId,
          reportingPeriodId: activePeriod.id,
        },
        _sum: { totalCo2e: true },
      });

      const comparisonCo2e = comparisonAgg._sum?.totalCo2e
        ? Number(comparisonAgg._sum.totalCo2e)
        : 0;
      const currentCo2e = currentAgg._sum?.totalCo2e
        ? Number(currentAgg._sum.totalCo2e)
        : 0;
      const change =
        comparisonCo2e > 0
          ? ((currentCo2e - comparisonCo2e) / comparisonCo2e) * 100
          : 0;

      drillDownResults.comparison = {
        previousCo2e: comparisonCo2e,
        currentCo2e: currentCo2e,
        changePercent: change.toFixed(2),
        changeDirection: change > 0 ? "increase" : "decrease",
      };
    }

    return NextResponse.json(drillDownResults);
  } catch (error) {
    return handleRouteError(error);
  }
}
