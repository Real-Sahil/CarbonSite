export const dynamic = "force-dynamic";

// Public token-gated endpoint for suppliers to view their submission history.
// No session auth — suppliers authenticated via token in URL.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { writeAuditLog } from "@/lib/db/audit";

// GET /api/supplier-portal/requests?token=... — list supplier's submission history
export async function GET(req: NextRequest) {
  const limited = await rateLimitRequest(req, {
    key: "supplier_portal_access",
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { code: "MISSING_TOKEN", message: "Token required." },
        { status: 400 },
      );
    }

    // Find any request with this token to identify the supplier
    const anyRequest = await prisma.supplierDataRequest.findUnique({
      where: { token },
      select: {
        supplierEmail: true,
        organizationId: true,
        id: true, // to log access
      },
    });

    if (!anyRequest) {
      return NextResponse.json(
        { code: "INVALID_TOKEN", message: "Invalid or expired token." },
        { status: 401 },
      );
    }

    const cursor = url.searchParams.get("cursor") ?? undefined;
    const take = Math.min(parseInt(url.searchParams.get("take") ?? "50", 10), 100);

    // Fetch all requests for this supplier across all periods
    const rawRequests = await prisma.supplierDataRequest.findMany({
      where: {
        supplierEmail: anyRequest.supplierEmail,
        organizationId: anyRequest.organizationId,
      },
      select: {
        id: true,
        token: true,
        categoryCode: true,
        status: true,
        sentAt: true,
        submittedAt: true,
        expiresAt: true,
        submittedData: true,
        qualityFlags: true,
        rejectionReason: true,
        reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
        organization: { select: { name: true } },
      },
      orderBy: { sentAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rawRequests.length > take;
    const requests = hasMore ? rawRequests.slice(0, take) : rawRequests;
    const nextCursor = hasMore ? requests[requests.length - 1]?.id : null;

    // Log portal access
    await writeAuditLog({
      organizationId: anyRequest.organizationId,
      actorUserId: null, // Portal access is public
      action: "supplier_portal.dashboard_accessed",
      resourceType: "SupplierDataRequest",
      resourceId: anyRequest.id,
      metadata: {
        supplierEmail: anyRequest.supplierEmail,
        requestCount: requests.length,
      },
    });

    return NextResponse.json({
      supplier: {
        email: anyRequest.supplierEmail,
        orgName: requests[0]?.organization.name,
      },
      nextCursor,
      hasMore,
      requests: requests.map((r) => ({
        id: r.id,
        token: r.token,
        categoryCode: r.categoryCode,
        categoryName: r.categoryCode.replace(/^s\d-/, "").replace(/-/g, " "),
        status: r.status,
        sentAt: r.sentAt.toISOString(),
        submittedAt: r.submittedAt?.toISOString() ?? null,
        expiresAt: r.expiresAt.toISOString(),
        expired: r.expiresAt < new Date(),
        periodLabel: r.reportingPeriod.label,
        periodStart: r.reportingPeriod.startDate.toISOString(),
        periodEnd: r.reportingPeriod.endDate.toISOString(),
        submittedData: r.submittedData,
        qualityFlagsCount: r.qualityFlags ? (Array.isArray(r.qualityFlags) ? r.qualityFlags.length : 0) : 0,
        hasRejection: !!r.rejectionReason,
        rejectionReason: r.rejectionReason,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message },
      { status: 500 },
    );
  }
}
