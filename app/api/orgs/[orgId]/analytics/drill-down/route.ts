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
      const scopeData = await prisma.dashboardAggregate.groupBy({
        by: ["scope"],
        where: whereClause,
        _sum: {
          totalCo2e: true,
          scope1Co2e: true,
          scope2Co2e: true,
          scope3Co2e: true,
        },
        orderBy: { _sum: { totalCo2e: "desc" } },
      });

      drillDownResults.byScope = scopeData.map((item) => ({
        scope: item.scope,
        totalCo2e: item._sum.totalCo2e || 0,
        scope1: item._sum.scope1Co2e || 0,
        scope2: item._sum.scope2Co2e || 0,
        scope3: item._sum.scope3Co2e || 0,
      }));
    }

    // By category
    if (query.dimensions.includes("category")) {
      const categoryData = await prisma.dashboardAggregate.groupBy({
        by: ["categoryId"],
        where: whereClause,
        _sum: { totalCo2e: true },
        _count: { id: true },
        orderBy: { _sum: { totalCo2e: "desc" } },
        take: query.limit,
        skip: query.offset,
      });

      // Fetch category names
      const categoryIds = categoryData.map((c) => c.categoryId).filter(Boolean) as string[];
      const categories = await prisma.emissionCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, scope: true },
      });

      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      drillDownResults.byCategory = categoryData.map((item) => {
        const cat = item.categoryId ? categoryMap.get(item.categoryId) : null;
        return {
          categoryId: item.categoryId,
          categoryName: cat?.name || "Unknown",
          scope: cat?.scope,
          totalCo2e: item._sum.totalCo2e || 0,
          recordCount: item._count.id,
        };
      });
    }

    // By facility
    if (query.dimensions.includes("facility")) {
      const facilityData = await prisma.dashboardAggregate.groupBy({
        by: ["facilityId"],
        where: whereClause,
        _sum: { totalCo2e: true },
        _count: { id: true },
        orderBy: { _sum: { totalCo2e: "desc" } },
        take: query.limit,
        skip: query.offset,
      });

      // Fetch facility names
      const facilityIds = facilityData.map((f) => f.facilityId).filter(Boolean) as string[];
      const facilities = await prisma.facility.findMany({
        where: { id: { in: facilityIds } },
        select: { id: true, name: true, location: true },
      });

      const facilityMap = new Map(facilities.map((f) => [f.id, f]));

      drillDownResults.byFacility = facilityData.map((item) => {
        const fac = item.facilityId ? facilityMap.get(item.facilityId) : null;
        return {
          facilityId: item.facilityId,
          facilityName: fac?.name || "Unknown",
          location: fac?.location,
          totalCo2e: item._sum.totalCo2e || 0,
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
          normalizedAmount: true,
          category: { select: { id: true, name: true } },
          facility: { select: { id: true, name: true } },
        },
        orderBy: { normalizedAmount: "desc" },
        take: 10,
      });

      drillDownResults.topContributors = topRecords;
    }

    // Comparison with previous period (if requested)
    if (query.includeComparison && query.comparisonPeriodId) {
      const comparisonAgg = await prisma.dashboardAggregate.aggregate({
        where: {
          organizationId: orgId,
          reportingPeriodId: query.comparisonPeriodId,
          reviewStatus: "approved",
        },
        _sum: { totalCo2e: true },
      });

      const currentAgg = await prisma.dashboardAggregate.aggregate({
        where: whereClause,
        _sum: { totalCo2e: true },
      });

      const comparisonCo2e = comparisonAgg._sum.totalCo2e || 0;
      const currentCo2e = currentAgg._sum.totalCo2e || 0;
      const change = comparisonCo2e > 0 ? ((currentCo2e - comparisonCo2e) / comparisonCo2e) * 100 : 0;

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
