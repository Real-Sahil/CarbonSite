export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
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

    await requireOrgMember(orgId, "admin", "editor", "viewer");

    const suppliers = await prisma.supplierPerformance.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        history: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
      },
      orderBy: {
        dataQualityScore: "desc",
      },
    });

    const formattedSuppliers = suppliers.map((perf) => {
      const totalSubmissions = perf.submissionCount;
      const approvalRate =
        totalSubmissions > 0
          ? (perf.approvedCount / totalSubmissions) * 100
          : 0;
      const onTimeRate =
        totalSubmissions > 0
          ? (perf.onTimeCount / totalSubmissions) * 100
          : 0;

      return {
        supplierId: perf.supplierId,
        supplierName: perf.supplier?.name || "Unknown Supplier",
        submissionCount: totalSubmissions,
        approvalRate,
        rejectionRate:
          totalSubmissions > 0
            ? (perf.rejectedCount / totalSubmissions) * 100
            : 0,
        onTimeRate,
        completenessScore: perf.completenessScore,
        dataQualityScore: perf.dataQualityScore,
        trend: perf.lastDataQualityTrend || "stable",
        lastUpdated: perf.updatedAt,
      };
    });

    return json(
      {
        suppliers: formattedSuppliers,
        pagination: {
          total: formattedSuppliers.length,
        },
      },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
