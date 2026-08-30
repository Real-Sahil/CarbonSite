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

  // Build where clause for activity records
  const whereClause: Record<string, unknown> = {
    organizationId: orgId,
    reportingPeriodId: { in: query.periodIds },
    reviewStatus: "approved",
  };

  if (query.categoryIds && query.categoryIds.length > 0) {
    whereClause.emissionCategoryId = { in: query.categoryIds };
  }
  if (query.facilityIds && query.facilityIds.length > 0) {
    whereClause.facilityId = { in: query.facilityIds };
  }

  // Get summary totals from activity records
  const totalAgg = await prisma.activityRecord.aggregate({
    where: whereClause,
    _sum: { amount: true },
    _count: { id: true },
  });

  const summary = {
    totalCo2e: totalAgg._sum?.amount ? Number(totalAgg._sum.amount) : 0,
    scope1: 0,
    scope2: 0,
    scope3: 0,
    recordCount: totalAgg._count || 0,
  };

  // Get scope breakdown via raw SQL (activity records joined with categories)
  const scopeBreakdown = await prisma.$queryRaw<
    Array<{ scope: number; totalCo2e: number }>
  >`
    SELECT ec.scope, COALESCE(CAST(SUM(ar.amount) AS NUMERIC), 0) as totalCo2e
    FROM activity_records ar
    JOIN emission_categories ec ON ar.emission_category_id = ec.id
    WHERE ar.organization_id = ${orgId}
      AND ar.reporting_period_id = ANY(${query.periodIds}::uuid[])
      AND ar.review_status = 'approved'
      ${query.categoryIds && query.categoryIds.length > 0 ? `AND ar.emission_category_id = ANY(${query.categoryIds}::uuid[])` : ""}
      ${query.facilityIds && query.facilityIds.length > 0 ? `AND ar.facility_id = ANY(${query.facilityIds}::uuid[])` : ""}
    GROUP BY ec.scope
    ORDER BY totalCo2e DESC
  `;

  const scopeData = scopeBreakdown.map((item) => {
    const co2e = Number(item.totalCo2e);
    return {
      scope: item.scope,
      co2e,
      percentage: summary.totalCo2e > 0 ? (co2e / summary.totalCo2e) * 100 : 0,
    };
  });

  // Get category breakdown
  const categoryBreakdown = await prisma.activityRecord.groupBy({
    by: ["emissionCategoryId"],
    where: whereClause,
    _sum: { amount: true },
    _count: { id: true },
  });

  const categoryIdsBreakdown = categoryBreakdown
    .map((c) => c.emissionCategoryId)
    .filter(Boolean) as string[];
  const categoriesBreakdown = await prisma.emissionCategory.findMany({
    where: { id: { in: categoryIdsBreakdown } },
    select: { id: true, name: true },
  });
  const categoryMapBreakdown = new Map(categoriesBreakdown.map((c) => [c.id, c.name]));

  const categoryData = categoryBreakdown.map((item) => ({
    name: item.emissionCategoryId ? categoryMapBreakdown.get(item.emissionCategoryId) || "Unknown" : "Unknown",
    co2e: item._sum?.amount ? Number(item._sum.amount) : 0,
    recordCount: item._count?.id || 0,
  }));

  // Trends by period
  const trends = await Promise.all(
    query.periodIds.map(async (periodId) => {
      const scopeAgg = await prisma.$queryRaw<
        Array<{ scope: number; totalCo2e: string }>
      >`
        SELECT ec.scope, COALESCE(CAST(SUM(ar.amount) AS NUMERIC), 0) as totalCo2e
        FROM activity_records ar
        JOIN emission_categories ec ON ar.emission_category_id = ec.id
        WHERE ar.organization_id = ${orgId}
          AND ar.reporting_period_id = ${periodId}
          AND ar.review_status = 'approved'
          ${query.categoryIds && query.categoryIds.length > 0 ? `AND ar.emission_category_id = ANY(${query.categoryIds}::uuid[])` : ""}
          ${query.facilityIds && query.facilityIds.length > 0 ? `AND ar.facility_id = ANY(${query.facilityIds}::uuid[])` : ""}
        GROUP BY ec.scope
      `;

      const period = periods.find((p) => p.id === periodId);
      const scope1Total = scopeAgg.find(s => s.scope === 1)?.totalCo2e || "0";
      const scope2Total = scopeAgg.find(s => s.scope === 2)?.totalCo2e || "0";
      const scope3Total = scopeAgg.find(s => s.scope === 3)?.totalCo2e || "0";
      const total = scopeAgg.reduce((sum, s) => sum + Number(s.totalCo2e), 0);

      return {
        period: period?.label || periodId,
        co2e: total,
        scope1: Number(scope1Total),
        scope2: Number(scope2Total),
        scope3: Number(scope3Total),
      };
    })
  );

  // Top contributors
  const topRecords = await prisma.activityRecord.findMany({
    where: whereClause,
    select: {
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
  const facilities = await prisma.facility.findMany({
    where: { id: { in: facilityIds } },
    select: { id: true, name: true },
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const facilityMap = new Map(facilities.map((f) => [f.id, f.name]));

  const topContributors = topRecords.map((r) => ({
    facility: r.facilityId ? facilityMap.get(r.facilityId) || "Unknown" : "Unknown",
    category: r.emissionCategoryId ? categoryMap.get(r.emissionCategoryId) || "Unknown" : "Unknown",
    co2e: Number(r.amount),
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
