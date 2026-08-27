import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

// Get request details for supplier
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const { user } = await requireSession();
    const { requestId } = await params;

    // Verify user is a supplier
    const supplierMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        role: "supplier",
        terminatedAt: null,
      },
      include: {
        organization: { select: { id: true } },
      },
    });

    if (!supplierMembership) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "You do not have access to this resource." },
        { status: 403 },
      );
    }

    // Get the request
    const request = await prisma.supplierDataRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.organizationId !== supplierMembership.organization.id) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Request not found." },
        { status: 404 },
      );
    }

    // Verify the supplier has access to this request (email match)
    if (request.supplierEmail !== user.email) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "You do not have access to this request." },
        { status: 403 },
      );
    }

    // Get period info
    const period = await prisma.reportingPeriod.findUnique({
      where: { id: request.reportingPeriodId },
      select: { label: true },
    });

    return NextResponse.json({
      id: request.id,
      categoryCode: request.categoryCode,
      categoryName: request.categoryCode.replace(/^s\d-/, "").replace(/-/g, " "),
      status: request.status,
      deadline: request.expiresAt.toISOString(),
      periodLabel: period?.label,
      submittedData: request.submittedData as {
        quantity: number;
        unit: string;
        description?: string | null;
      } | null,
      qualityFlags: request.qualityFlags as Array<{
        field: string;
        severity: "warning" | "critical" | "info";
        message: string;
        suggestedRange?: { min: number; max: number };
      }> | null,
      rejectionReason: request.rejectionReason,
      reviewedAt: request.reviewedAt?.toISOString(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
