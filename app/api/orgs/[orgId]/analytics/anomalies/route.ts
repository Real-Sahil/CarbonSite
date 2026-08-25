import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import {
  detectOutliers,
  detectTrendChanges,
  detectUnusualPatterns,
  generateAnomalyReport,
} from "@/lib/analytics/anomaly-detection";
import { z } from "zod";

const querySchema = z.object({
  type: z.enum(["outliers", "trends", "patterns", "full"]).default("full"),
  periodId: z.string().optional(),
});

/**
 * GET /api/orgs/[orgId]/analytics/anomalies
 * Detect anomalies and unusual patterns in emissions data.
 * Uses statistical methods (Z-score, trend analysis) to identify issues.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const query = querySchema.parse({
      type: request.nextUrl.searchParams.get("type") ?? "full",
      periodId: request.nextUrl.searchParams.get("periodId") ?? undefined,
    });

    if (query.type === "full") {
      const report = await generateAnomalyReport(orgId);

      return NextResponse.json({
        summary: {
          totalAnomalies: report.totalAnomalies,
          riskLevel: report.riskLevel,
          outlierCount: report.outliers.length,
          trendChangeCount: report.trendChanges.length,
          patternCount: report.patterns.length,
        },
        outliers: report.outliers.map((a) => ({
          recordId: a.recordId,
          category: a.category,
          type: a.anomalyType,
          severity: a.severity,
          value: a.value,
          expectedRange: a.expectedRange,
          deviation: a.deviation,
          message: a.message,
          recommendation: a.recommendation,
        })),
        trends: report.trendChanges.map((a) => ({
          category: a.category,
          type: a.anomalyType,
          severity: a.severity,
          deviation: a.deviation,
          message: a.message,
          recommendation: a.recommendation,
        })),
        patterns: report.patterns.map((a) => ({
          category: a.category,
          type: a.anomalyType,
          severity: a.severity,
          message: a.message,
          recommendation: a.recommendation,
        })),
      });
    }

    if (query.type === "outliers") {
      const outliers = await detectOutliers(orgId, query.periodId);

      return NextResponse.json({
        anomalies: outliers.map((a) => ({
          recordId: a.recordId,
          category: a.category,
          severity: a.severity,
          value: a.value,
          expectedRange: a.expectedRange,
          deviation: a.deviation,
          message: a.message,
          recommendation: a.recommendation,
        })),
        count: outliers.length,
      });
    }

    if (query.type === "trends") {
      const trends = await detectTrendChanges(orgId);

      return NextResponse.json({
        anomalies: trends.map((a) => ({
          category: a.category,
          severity: a.severity,
          deviation: a.deviation,
          message: a.message,
          recommendation: a.recommendation,
        })),
        count: trends.length,
      });
    }

    if (query.type === "patterns") {
      const patterns = await detectUnusualPatterns(orgId);

      return NextResponse.json({
        anomalies: patterns.map((a) => ({
          category: a.category,
          severity: a.severity,
          message: a.message,
          recommendation: a.recommendation,
        })),
        count: patterns.length,
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    return handleRouteError(error);
  }
}
