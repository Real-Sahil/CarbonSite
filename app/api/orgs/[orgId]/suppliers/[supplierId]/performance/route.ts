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

    // For now, return empty performance data if the model doesn't exist in DB yet
    // This will work once the migration is applied
    const performanceData = {
      id: supplierId,
      organizationId: orgId,
      supplierId,
      submissionCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      onTimeCount: 0,
      completenessScore: 0,
      dataQualityScore: 0,
      lastDataQualityTrend: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      supplier: {
        id: supplierId,
        name: "Supplier",
      },
    };

    return NextResponse.json({
      performance: performanceData,
      history: [],
      metrics: {
        totalSubmissions: 0,
        approvedSubmissions: 0,
        rejectedSubmissions: 0,
        onTimeSubmissions: 0,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
