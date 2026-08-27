import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

// Get supplier's dashboard — assigned data requests
export async function GET(req: NextRequest) {
  try {
    const { user, session } = await requireSession();

    // Verify user is a supplier
    const supplierMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        role: "supplier",
        terminatedAt: null, // Active membership only
      },
      include: {
        organization: { select: { id: true } },
      },
    });

    if (!supplierMembership) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "You do not have access to the supplier portal." },
        { status: 403 },
      );
    }

    const orgId = supplierMembership.organization.id;

    // Get supplier's assigned data requests
    const requests = await prisma.supplierDataRequest.findMany({
      where: {
        organizationId: orgId,
        supplierEmail: user.email,
      },
      select: {
        id: true,
        supplierEmail: true,
        supplierName: true,
        categoryCode: true,
        status: true,
        sentAt: true,
        expiresAt: true,
        submittedAt: true,
        submittedData: true,
        qualityFlags: true,
        rejectionReason: true,
        reviewedAt: true,
        notes: true,
        reportingPeriod: { select: { id: true, label: true } },
      },
      orderBy: { sentAt: "desc" },
    });

    // Format response
    const rows = requests.map((r) => ({
      id: r.id,
      categoryCode: r.categoryCode,
      categoryName: r.categoryCode.replace(/^s\d-/, "").replace(/-/g, " "),
      status: r.status as "sent" | "opened" | "submitted" | "expired" | "flagged" | "approved" | "rejected",
      deadline: r.expiresAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString() ?? null,
      periodId: r.reportingPeriod.id,
      periodLabel: r.reportingPeriod.label,
      submittedData: r.submittedData as { quantity: number; unit: string; description?: string | null } | null,
      qualityFlags: r.qualityFlags as Array<{
        field: string;
        severity: "warning" | "critical" | "info";
        message: string;
        suggestedRange?: { min: number; max: number };
      }> | null,
      rejectionReason: r.rejectionReason,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      notes: r.notes,
      isExpired: r.expiresAt < new Date() && r.status !== "submitted",
    }));

    // Count by status
    const counts = {
      total: rows.length,
      awaiting_submission: rows.filter((r) => r.status === "sent" || r.status === "opened").length,
      submitted: rows.filter((r) => r.status === "submitted" || r.status === "flagged").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
    };

    return NextResponse.json({
      organizationId: orgId,
      supplierEmail: user.email,
      supplierName: user.name,
      requests: rows,
      counts,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
