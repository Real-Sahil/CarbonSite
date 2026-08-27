/**
 * Supplier Performance Tracking API
 * GET /api/orgs/:orgId/suppliers/:supplierId/performance
 *
 * Returns performance metrics for a supplier including:
 * - Submission counts and approval rates
 * - On-time delivery tracking
 * - Data quality scores
 * - Performance trends
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; supplierId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, supplierId } = await params;

    // Verify org membership (admin/reviewer can view supplier performance)
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "auditor");

    // Fetch supplier performance record
    const performance = await prisma.supplierPerformance.findUnique({
      where: {
        organizationId_supplierId: {
          organizationId: orgId,
          supplierId,
        },
      },
    });

    if (!performance) {
      return apiError(
        "NOT_FOUND",
        "No performance data yet. Supplier has not submitted any records.",
        404
      );
    }

    // Calculate derived metrics
    const approvalRate =
      performance.submissionCount > 0
        ? (performance.approvedCount / performance.submissionCount) * 100
        : 0;

    const rejectionRate =
      performance.submissionCount > 0
        ? (performance.rejectedCount / performance.submissionCount) * 100
        : 0;

    const onTimeRate =
      performance.submissionCount > 0
        ? (performance.onTimeCount / performance.submissionCount) * 100
        : 0;

    const response = NextResponse.json({
      performance: {
        id: performance.id,
        organizationId: performance.organizationId,
        supplierId: performance.supplierId,
        metrics: {
          submissionCount: performance.submissionCount,
          approvedCount: performance.approvedCount,
          rejectedCount: performance.rejectedCount,
          onTimeCount: performance.onTimeCount,
          approvalRate: Math.round(approvalRate * 100) / 100,
          rejectionRate: Math.round(rejectionRate * 100) / 100,
          onTimeRate: Math.round(onTimeRate * 100) / 100,
        },
        scores: {
          completenessScore: performance.completenessScore
            ? parseFloat(performance.completenessScore.toString())
            : null,
          dataQualityScore: performance.dataQualityScore
            ? parseFloat(performance.dataQualityScore.toString())
            : null,
        },
        trend: performance.lastDataQualityTrend,
        updatedAt: performance.updatedAt,
        createdAt: performance.createdAt,
      },
    });

    response.headers.set("Cache-Control", "private, max-age=60");
    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * PATCH /api/orgs/:orgId/suppliers/:supplierId/performance
 * Admin-only endpoint to manually update supplier performance metrics
 * (Used for data corrections or backfilling)
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, supplierId } = await params;

    // Only admins can update performance metrics
    await requireOrgMember(orgId, "admin");

    const body = await req.json();
    const {
      submissionCount,
      approvedCount,
      rejectedCount,
      onTimeCount,
      completenessScore,
      dataQualityScore,
      lastDataQualityTrend,
    } = body;

    // Find or create performance record
    const performance = await prisma.supplierPerformance.upsert({
      where: {
        organizationId_supplierId: {
          organizationId: orgId,
          supplierId,
        },
      },
      update: {
        ...(typeof submissionCount === "number" && { submissionCount }),
        ...(typeof approvedCount === "number" && { approvedCount }),
        ...(typeof rejectedCount === "number" && { rejectedCount }),
        ...(typeof onTimeCount === "number" && { onTimeCount }),
        ...(typeof completenessScore === "number" && { completenessScore }),
        ...(typeof dataQualityScore === "number" && { dataQualityScore }),
        ...(lastDataQualityTrend && { lastDataQualityTrend }),
      },
      create: {
        organizationId: orgId,
        supplierId,
        submissionCount: submissionCount ?? 0,
        approvedCount: approvedCount ?? 0,
        rejectedCount: rejectedCount ?? 0,
        onTimeCount: onTimeCount ?? 0,
        completenessScore: completenessScore ?? null,
        dataQualityScore: dataQualityScore ?? null,
        lastDataQualityTrend: lastDataQualityTrend ?? null,
      },
    });

    return NextResponse.json(
      {
        message: "Supplier performance updated",
        performance,
      },
      { status: 200 }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
