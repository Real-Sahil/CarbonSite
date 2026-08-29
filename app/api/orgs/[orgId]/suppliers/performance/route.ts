export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    // Fetch all supplier performance data for this organization
    const performances = await prisma.supplierPerformance.findMany({
      where: { organizationId: orgId },
      orderBy: { dataQualityScore: "desc" },
      take: 100,
      include: {
        supplier: {
          select: { id: true, name: true },
        },
      },
    });

    if (performances.length === 0) {
      return json(
        {
          suppliers: [],
          pagination: {
            nextCursor: null,
            hasMore: false,
          },
        },
        { version }
      );
    }

    // Calculate metrics for each supplier
    const suppliers = performances.map((perf) => {
      const totalSubmissions = perf.submissionCount;
      const acceptanceRate =
        totalSubmissions > 0
          ? (perf.approvedCount / totalSubmissions) * 100
          : 0;
      const onTimeRate =
        totalSubmissions > 0
          ? (perf.onTimeCount / totalSubmissions) * 100
          : 0;

      return {
        id: perf.id,
        supplierId: perf.supplierId,
        supplierName: perf.supplier?.name || "Unknown Supplier",
        submissionCount: perf.submissionCount,
        approvedCount: perf.approvedCount,
        rejectedCount: perf.rejectedCount,
        acceptanceRate: Math.round(acceptanceRate * 10) / 10,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        completenessScore: perf.completenessScore
          ? parseFloat(String(perf.completenessScore))
          : 0,
        dataQualityScore: perf.dataQualityScore
          ? parseFloat(String(perf.dataQualityScore))
          : 0,
        lastDataQualityTrend: perf.lastDataQualityTrend || "stable",
        updatedAt: perf.updatedAt.toISOString(),
      };
    });

    return json(
      {
        suppliers,
        pagination: {
          nextCursor: null,
          hasMore: false,
        },
      },
      { version }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
