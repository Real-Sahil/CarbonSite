import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; supplierId: string }> }
) {
  try {
    const { orgId, supplierId } = await params;

    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    // Fetch supplier performance data
    const performance = await prisma.supplierPerformance.findUnique({
      where: {
        organizationId_supplierId: {
          organizationId: orgId,
          supplierId,
        },
      },
    });

    // Fetch supplier organization details
    const supplier = await prisma.organization.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true },
    });

    // Fetch performance history (last 12 records)
    const history = await prisma.supplierPerformanceHistory.findMany({
      where: {
        organizationId: orgId,
        supplierPerformance: {
          supplierId,
        },
      },
      orderBy: { recordedAt: "desc" },
      take: 12,
    });

    const performanceData = performance || {
      id: supplierId,
      organizationId: orgId,
      supplierId,
      submissionCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      onTimeCount: 0,
      completenessScore: null,
      dataQualityScore: null,
      lastDataQualityTrend: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json({
      performance: {
        ...performanceData,
        supplier: supplier || { id: supplierId, name: "Unknown" },
      },
      history: history.reverse(),
      metrics: {
        totalSubmissions: performanceData.submissionCount,
        approvedSubmissions: performanceData.approvedCount,
        rejectedSubmissions: performanceData.rejectedCount,
        onTimeSubmissions: performanceData.onTimeCount,
        approvalRate:
          performanceData.submissionCount > 0
            ? (performanceData.approvedCount / performanceData.submissionCount) * 100
            : 0,
        onTimeRate:
          performanceData.approvedCount > 0
            ? (performanceData.onTimeCount / performanceData.approvedCount) * 100
            : 0,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
