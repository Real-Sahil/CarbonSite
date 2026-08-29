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

    // Fetch supplier org data to get name
    const supplierOrg = await prisma.organization.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true },
    });

    if (!supplierOrg) {
      return apiError("NOT_FOUND", "Supplier organization not found", 404);
    }

    const totalSubmissions = performance.submissionCount;
    const acceptanceRate =
      totalSubmissions > 0
        ? (performance.approvedCount / totalSubmissions) * 100
        : 0;
    const rejectionRate =
      totalSubmissions > 0
        ? (performance.rejectedCount / totalSubmissions) * 100
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
        performance: {
          id: performance.id,
          organizationId: orgId,
          supplierId,
          submissionCount: performance.submissionCount,
          approvedCount: performance.approvedCount,
          rejectedCount: performance.rejectedCount,
          onTimeCount: performance.onTimeCount,
          completenessScore: completenessScoreNum,
          dataQualityScore: dataQualityScoreNum,
          acceptanceRate: Math.round(acceptanceRate * 10) / 10,
          onTimeRate: 0, // Placeholder for on-time rate calculation
          rejectionRate: Math.round(rejectionRate * 10) / 10,
          lastDataQualityTrend: trend,
          createdAt: performance.createdAt.toISOString(),
          updatedAt: performance.updatedAt.toISOString(),
          supplier: {
            id: supplierOrg.id,
            name: supplierOrg.name,
          },
        },
        history: performance.history.map((h) => ({
          id: h.id,
          completenessScore: parseFloat(String(h.completenessScore ?? 0)),
          dataQualityScore: parseFloat(String(h.dataQualityScore ?? 0)),
          submissionCount: h.submissionCount,
          approvedCount: h.approvedCount,
          recordedAt: h.recordedAt.toISOString(),
        })),
        metrics: {
          totalSubmissions: performance.submissionCount,
          approvedSubmissions: performance.approvedCount,
          rejectedSubmissions: performance.rejectedCount,
          onTimeSubmissions: performance.onTimeCount,
        },
      },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
