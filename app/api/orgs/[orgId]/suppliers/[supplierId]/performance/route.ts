export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";

type Params = { params: Promise<{ orgId: string; supplierId: string }> };

function calculateTrend(
  history: Array<{ dataQualityScore: string | number; recordedAt: Date }>
): "improving" | "stable" | "declining" {
  if (history.length < 2) return "stable";

  const recent = parseFloat(String(history[0]?.dataQualityScore ?? 0));
  const oldest = parseFloat(String(history[history.length - 1]?.dataQualityScore ?? 0));

  const change = recent - oldest;
  if (change > 5) return "improving";
  if (change < -5) return "declining";
  return "stable";
}

export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId, supplierId } = await params;
    const { version, json } = await withApiVersion(req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, "admin", "editor", "viewer");

    const performance = await prisma.supplierPerformance.findFirst({
      where: {
        organizationId: orgId,
        supplierId,
      },
      include: {
        history: {
          orderBy: { recordedAt: "desc" },
          take: 30,
        },
      },
    });

    if (!performance) {
      return apiError("NOT_FOUND", "Supplier performance data not found", 404);
    }

    const totalSubmissions = performance.submissionCount;
    const approvalRate =
      totalSubmissions > 0
        ? (performance.approvedCount / totalSubmissions) * 100
        : 0;

    const completenessScoreNum = parseFloat(String(performance.completenessScore ?? 0));
    const dataQualityScoreNum = parseFloat(String(performance.dataQualityScore ?? 0));

    const convertedHistory = performance.history.map((h) => ({
      dataQualityScore: parseFloat(String(h.dataQualityScore ?? 0)),
      recordedAt: h.recordedAt,
    }));
    const trend = calculateTrend(convertedHistory);

    return json(
      {
        supplierId,
        performance: {
          submissionCount: performance.submissionCount,
          approvedCount: performance.approvedCount,
          completenessScore: completenessScoreNum,
          dataQualityScore: dataQualityScoreNum,
          trend,
          lastUpdated: performance.updatedAt,
        },
        statistics: {
          approvalRate: Math.round(approvalRate * 10) / 10,
          averageCompletenessScore: Math.round(completenessScoreNum),
          averageDataQualityScore: Math.round(dataQualityScoreNum),
        },
        history: performance.history.map((h) => {
          const completeness = parseFloat(String(h.completenessScore ?? 0));
          const quality = parseFloat(String(h.dataQualityScore ?? 0));
          return {
            recordedAt: h.recordedAt,
            completenessScore: completeness,
            dataQualityScore: quality,
            submissionCount: h.submissionCount,
            approvalRate:
              h.submissionCount > 0
                ? Math.round((h.approvedCount / h.submissionCount) * 1000) / 10
                : 0,
          };
        }),
      },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
