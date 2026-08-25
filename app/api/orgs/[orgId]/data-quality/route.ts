import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import {
  calculateDataQualityScore,
  getDataQualityTrend,
  identifyHighRiskRecords,
} from "@/lib/data-quality/scorer";
import { z } from "zod";

const querySchema = z.object({
  periodId: z.string().optional(),
  includeRiskRecords: z.string().transform(v => v === 'true').optional(),
  includeTrend: z.string().transform(v => v === 'true').optional(),
});

/**
 * GET /api/orgs/[orgId]/data-quality
 * Calculate data quality score for organization.
 * Includes completeness, accuracy, timeliness, consistency metrics.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const query = querySchema.parse({
      periodId: request.nextUrl.searchParams.get("periodId") ?? undefined,
      includeRiskRecords: request.nextUrl.searchParams.get("includeRiskRecords") ?? undefined,
      includeTrend: request.nextUrl.searchParams.get("includeTrend") ?? undefined,
    });

    // Calculate overall score
    const metrics = await calculateDataQualityScore(orgId, query.periodId);

    const response: any = {
      overallScore: metrics.overallScore,
      scoreBreakdown: {
        completeness: metrics.completeness,
        accuracy: metrics.accuracy,
        timeliness: metrics.timeliness,
        consistency: metrics.consistency,
      },
      summary: metrics.summary,
      issues: metrics.issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        affectedRecordCount: issue.affectedRecordCount,
        recommendation: issue.recommendation,
      })),
      scoreInterpretation:
        metrics.overallScore >= 80
          ? "Excellent - High quality, audit-ready data"
          : metrics.overallScore >= 60
            ? "Good - Minor improvements recommended"
            : metrics.overallScore >= 40
              ? "Fair - Notable data quality issues to address"
              : "Poor - Critical issues require immediate attention",
    };

    // Optionally include trend data
    if (query.includeTrend) {
      const trend = await getDataQualityTrend(orgId, 6);
      response.trend = trend;
    }

    // Optionally include high-risk records
    if (query.includeRiskRecords) {
      const riskRecords = await identifyHighRiskRecords(orgId, 10);
      response.riskRecords = riskRecords;
    }

    return NextResponse.json(response);
  } catch (error) {
    return handleRouteError(error);
  }
}
