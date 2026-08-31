export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; supplierId: string }> }
) {
  try {
    const { orgId, supplierId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    const performance = await prisma.supplierPerformance.findUnique({
      where: {
        organizationId_supplierId: {
          organizationId: orgId,
          supplierId: supplierId,
        },
      },
      include: {
        supplier: {
          select: { id: true, name: true },
        },
      },
    });

    if (!performance) {
      return apiError("NOT_FOUND", "Supplier performance record not found", 404);
    }

    const history = await prisma.supplierPerformanceHistory.findMany({
      where: {
        supplierPerformanceId: performance.id,
        organizationId: orgId,
      },
      orderBy: { recordedAt: "desc" },
      take: 90,
      select: {
        id: true,
        completenessScore: true,
        dataQualityScore: true,
        submissionCount: true,
        approvedCount: true,
        recordedAt: true,
      },
    });

    const submissionCount = performance.submissionCount;
    const acceptanceRate =
      submissionCount > 0
        ? (performance.approvedCount / submissionCount) * 100
        : 0;
    const onTimeRate =
      submissionCount > 0
        ? (performance.onTimeCount / submissionCount) * 100
        : 0;
    const rejectionRate =
      submissionCount > 0
        ? (performance.rejectedCount / submissionCount) * 100
        : 0;

    return NextResponse.json({
      performance: {
        ...performance,
        completenessScore: Number(performance.completenessScore ?? 0),
        dataQualityScore: Number(performance.dataQualityScore ?? 0),
        acceptanceRate,
        onTimeRate,
        rejectionRate,
      },
      history: history.map((h) => ({
        ...h,
        completenessScore: Number(h.completenessScore),
        dataQualityScore: Number(h.dataQualityScore),
      })),
      metrics: {
        totalSubmissions: performance.submissionCount,
        approvedSubmissions: performance.approvedCount,
        rejectedSubmissions: performance.rejectedCount,
        onTimeSubmissions: performance.onTimeCount,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
