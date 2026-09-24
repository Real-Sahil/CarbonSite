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
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";
import { PRIMARY_SCOPE2_METHOD } from "@/lib/calculation/aggregate-filters";
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
}).refine((q) => !(q.categoryIds?.length && q.facilityIds?.length), {
  message: "Filter by category or by facility, not both.",
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
  const periodIds = periods.map((p) => p.id);

  // Figures come from the live DashboardAggregate rows (the same numbers as
  // the dashboard), never from raw activity amounts, which mix units. Each
  // breakdown reads only its own dimension rows so nothing is counted twice.
  const base = {
    organizationId: orgId,
    reportingPeriodId: { in: periodIds },
    snapshotId: null,
    businessUnitId: null,
    ...PRIMARY_SCOPE2_METHOD,
    ...(query.scopes?.length ? { scope: { in: query.scopes } } : {}),
  };
  const byCategoryIds = query.categoryIds?.length ? { in: query.categoryIds } : undefined;
  const byFacilityIds = query.facilityIds?.length ? { in: query.facilityIds } : undefined;
  const totalsWhere = byCategoryIds
    ? { ...base, facilityId: null, emissionCategoryId: byCategoryIds }
    : byFacilityIds
      ? { ...base, emissionCategoryId: null, facilityId: byFacilityIds }
      : { ...base, emissionCategoryId: null, facilityId: null };

  const [totalRows, categoryRows, facilityRows] = await Promise.all([
    prisma.dashboardAggregate.findMany({
      where: totalsWhere,
      select: { reportingPeriodId: true, scope: true, totalCo2e: true, recordCount: true },
    }),
    byFacilityIds
      ? Promise.resolve([])
      : prisma.dashboardAggregate.findMany({
          where: { ...base, facilityId: null, emissionCategoryId: byCategoryIds ?? { not: null } },
          select: { totalCo2e: true, recordCount: true, emissionCategory: { select: { name: true } } },
        }),
    byCategoryIds
      ? Promise.resolve([])
      : prisma.dashboardAggregate.findMany({
          where: { ...base, emissionCategoryId: null, facilityId: byFacilityIds ?? { not: null } },
          select: { totalCo2e: true, recordCount: true, facility: { select: { name: true } } },
        }),
  ]);

  const scopeTotals = [1, 2, 3].map((scope) =>
    totalRows.filter((r) => r.scope === scope).reduce((sum, r) => sum + Number(r.totalCo2e), 0),
  );
  const totalCo2e = scopeTotals[0] + scopeTotals[1] + scopeTotals[2];
  const summary = {
    totalCo2e,
    scope1: scopeTotals[0],
    scope2: scopeTotals[1],
    scope3: scopeTotals[2],
    recordCount: totalRows.reduce((sum, r) => sum + r.recordCount, 0),
  };

  const scopeData = [1, 2, 3]
    .map((scope, i) => ({ scope, co2e: scopeTotals[i], percentage: totalCo2e > 0 ? (scopeTotals[i] / totalCo2e) * 100 : 0 }))
    .filter((s) => s.co2e > 0)
    .sort((a, b) => b.co2e - a.co2e);

  const sumBy = (rows: Array<{ name: string; co2e: number; recordCount: number }>) => {
    const map = new Map<string, { name: string; co2e: number; recordCount: number }>();
    for (const r of rows) {
      const cur = map.get(r.name) ?? { name: r.name, co2e: 0, recordCount: 0 };
      cur.co2e += r.co2e;
      cur.recordCount += r.recordCount;
      map.set(r.name, cur);
    }
    return [...map.values()].sort((a, b) => b.co2e - a.co2e);
  };
  const categoryData = sumBy(
    categoryRows.map((r) => ({ name: r.emissionCategory?.name ?? "Unknown", co2e: Number(r.totalCo2e), recordCount: r.recordCount })),
  );
  const facilityData = sumBy(
    facilityRows.map((r) => ({ name: r.facility?.name ?? "Unknown", co2e: Number(r.totalCo2e), recordCount: r.recordCount })),
  );

  const trends = periods.map((period) => {
    const rows = totalRows.filter((r) => r.reportingPeriodId === period.id);
    const s = [1, 2, 3].map((scope) => rows.filter((r) => r.scope === scope).reduce((sum, r) => sum + Number(r.totalCo2e), 0));
    return { period: period.label, co2e: s[0] + s[1] + s[2], scope1: s[0], scope2: s[1], scope3: s[2] };
  });

  const topContributors = categoryData.slice(0, 10).map((c) => ({ facility: "All facilities", category: c.name, co2e: c.co2e }));

  // Generate recommendations based on data
  const recommendations: string[] = [];
  if (summary.scope3 > summary.scope1 + summary.scope2) {
    recommendations.push("Scope 3 emissions dominate. Focus supplier engagement strategy.");
  }
  if (summary.scope1 > summary.scope2) {
    recommendations.push("Scope 1 (fuel) is significant. Consider renewable energy transition.");
  }
  if (categoryData.length > 0) {
    recommendations.push(
      `${categoryData[0].name} is the largest contributor. Target this area for reduction initiatives.`
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
      byFacility: facilityData,
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
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

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
