/**
 * Custom Analytics Reports
 *
 * Generate and export custom analytics reports:
 * - CSV, Excel, PDF formats
 * - Multi-period comparisons
 * - Filtered by scope, facility, category
 * - Include charts, summary statistics, and recommendations
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

const ReportRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  periodIds: z.array(z.string()).min(1),
  scopes: z.array(z.number()).optional(),
  categoryIds: z.array(z.string()).optional(),
  facilityIds: z.array(z.string()).optional(),
  format: z.enum(["csv", "json", "pdf"]).default("csv"),
  includeCharts: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
  includeRecommendations: z.boolean().default(true),
});

type ReportRequest = z.infer<typeof ReportRequestSchema>;

interface ReportData {
  title: string;
  description?: string;
  generatedAt: string;
  periods: Array<{ id: string; label: string }>;
  summary: {
    totalCo2e: number;
    scope1: number;
    scope2: number;
    scope3: number;
    recordCount: number;
  };
  breakdowns: {
    byScope: Array<{ scope: number; co2e: number; percentage: number }>;
    byCategory: Array<{ name: string; co2e: number; recordCount: number }>;
    byFacility: Array<{ name: string; co2e: number; recordCount: number }>;
  };
  topContributors: Array<{
    facility: string;
    category: string;
    co2e: number;
  }>;
  trends: Array<{
    period: string;
    co2e: number;
    scope1: number;
    scope2: number;
    scope3: number;
  }>;
  recommendations: string[];
}

async function buildReportData(
  orgId: string,
  query: ReportRequest
): Promise<ReportData> {
  const periods = await prisma.reportingPeriod.findMany({
    where: { id: { in: query.periodIds }, organizationId: orgId },
    select: { id: true, label: true },
  });

  // Build where clause
  const whereClause: Record<string, unknown> = {
    organizationId: orgId,
    reportingPeriodId: { in: query.periodIds },
    reviewStatus: "approved",
  };

  if (query.scopes && query.scopes.length > 0) {
    whereClause.category = { scope: { in: query.scopes } };
  }
  if (query.categoryIds && query.categoryIds.length > 0) {
    whereClause.emissionCategoryId = { in: query.categoryIds };
  }
  if (query.facilityIds && query.facilityIds.length > 0) {
    whereClause.facilityId = { in: query.facilityIds };
  }

  // Get aggregates
  const aggregates = await prisma.dashboardAggregate.findMany({
    where: whereClause,
    select: {
      totalCo2e: true,
      scope1Co2e: true,
      scope2Co2e: true,
      scope3Co2e: true,
      reportingPeriodId: true,
    },
  });

  const summary = aggregates.reduce(
    (acc, agg) => ({
      totalCo2e: acc.totalCo2e + (agg.totalCo2e || 0),
      scope1: acc.scope1 + (agg.scope1Co2e || 0),
      scope2: acc.scope2 + (agg.scope2Co2e || 0),
      scope3: acc.scope3 + (agg.scope3Co2e || 0),
      recordCount: acc.recordCount + 1,
    }),
    { totalCo2e: 0, scope1: 0, scope2: 0, scope3: 0, recordCount: 0 }
  );

  // Get scope breakdown
  const scopeBreakdown = await prisma.dashboardAggregate.groupBy({
    by: ["scope"],
    where: whereClause,
    _sum: { totalCo2e: true },
  });

  const scopeData = scopeBreakdown.map((item) => {
    const co2e = item._sum.totalCo2e || 0;
    return {
      scope: item.scope || 0,
      co2e,
      percentage: summary.totalCo2e > 0 ? (co2e / summary.totalCo2e) * 100 : 0,
    };
  });

  // Get category breakdown
  const categoryBreakdown = await prisma.activityRecord.groupBy({
    by: ["emissionCategoryId"],
    where: whereClause,
    _sum: { normalizedAmount: true },
    _count: { id: true },
  });

  const categoryIds = categoryBreakdown
    .map((c) => c.emissionCategoryId)
    .filter(Boolean) as string[];
  const categories = await prisma.emissionCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const categoryData = categoryBreakdown.map((item) => ({
    name: item.emissionCategoryId ? categoryMap.get(item.emissionCategoryId) || "Unknown" : "Unknown",
    co2e: item._sum.normalizedAmount || 0,
    recordCount: item._count.id,
  }));

  // Trends by period
  const trends = await Promise.all(
    query.periodIds.map(async (periodId) => {
      const agg = await prisma.dashboardAggregate.aggregate({
        where: {
          organizationId: orgId,
          reportingPeriodId: periodId,
          reviewStatus: "approved",
        },
        _sum: {
          totalCo2e: true,
          scope1Co2e: true,
          scope2Co2e: true,
          scope3Co2e: true,
        },
      });
      const period = periods.find((p) => p.id === periodId);
      return {
        period: period?.label || periodId,
        co2e: agg._sum.totalCo2e || 0,
        scope1: agg._sum.scope1Co2e || 0,
        scope2: agg._sum.scope2Co2e || 0,
        scope3: agg._sum.scope3Co2e || 0,
      };
    })
  );

  // Top contributors
  const topRecords = await prisma.activityRecord.findMany({
    where: whereClause,
    select: {
      normalizedAmount: true,
      facility: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { normalizedAmount: "desc" },
    take: 10,
  });

  const topContributors = topRecords.map((r) => ({
    facility: r.facility?.name || "Unknown",
    category: r.category?.name || "Unknown",
    co2e: r.normalizedAmount,
  }));

  // Generate recommendations based on data
  const recommendations: string[] = [];
  if (summary.scope3 > summary.scope1 + summary.scope2) {
    recommendations.push("Scope 3 emissions dominate. Focus supplier engagement strategy.");
  }
  if (summary.scope1 > summary.scope2) {
    recommendations.push("Scope 1 (fuel) is significant. Consider renewable energy transition.");
  }
  if (categoryData.length > 0) {
    const topCategory = categoryData[0];
    recommendations.push(
      `${topCategory.name} is the largest contributor. Target this area for reduction initiatives.`
    );
  }

  return {
    title: query.title,
    description: query.description,
    generatedAt: new Date().toISOString(),
    periods: periods,
    summary,
    breakdowns: {
      byScope: scopeData,
      byCategory: categoryData,
      byFacility: [], // Would fetch facility data here
    },
    topContributors,
    trends,
    recommendations,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId);

    const body = await req.json();
    const query = ReportRequestSchema.parse(body);

    const reportData = await buildReportData(orgId, query);

    // Format response based on requested format
    if (query.format === "csv") {
      // Create CSV rows
      const rows: string[] = [];
      rows.push(`"${query.title}"`);
      rows.push(`Generated: ${reportData.generatedAt}`);
      rows.push("");

      rows.push("SUMMARY");
      rows.push(`Total CO₂e (kg),${reportData.summary.totalCo2e.toFixed(2)}`);
      rows.push(`Scope 1,${reportData.summary.scope1.toFixed(2)}`);
      rows.push(`Scope 2,${reportData.summary.scope2.toFixed(2)}`);
      rows.push(`Scope 3,${reportData.summary.scope3.toFixed(2)}`);
      rows.push("");

      rows.push("BY SCOPE");
      rows.push("Scope,CO₂e (kg),Percentage");
      reportData.breakdowns.byScope.forEach((item) => {
        rows.push(`${item.scope},${item.co2e.toFixed(2)},${item.percentage.toFixed(1)}%`);
      });
      rows.push("");

      rows.push("BY CATEGORY");
      rows.push("Category,CO₂e (kg),Records");
      reportData.breakdowns.byCategory.forEach((item) => {
        rows.push(`"${item.name}",${item.co2e.toFixed(2)},${item.recordCount}`);
      });

      const csv = rows.join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${query.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv"`,
        },
      });
    } else if (query.format === "json") {
      return NextResponse.json(reportData);
    } else if (query.format === "pdf") {
      // PDF generation would happen here (integrate with PDF library)
      // For now, return JSON that frontend can convert to PDF
      return NextResponse.json(reportData, {
        headers: {
          "X-Format": "pdf",
        },
      });
    }

    return NextResponse.json(reportData);
  } catch (error) {
    return handleRouteError(error);
  }
}
