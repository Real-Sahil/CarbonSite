export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

// GET /api/orgs/[orgId]/supplier-reports — list supplier reports for review
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "auditor");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "submitted";
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "25"), 100);

    const reports = await prisma.supplierReport.findMany({
      where: {
        organizationId: orgId,
        ...(status !== "all" ? { status } : {}),
      },
      orderBy: { submittedAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        supplierEmail: true,
        supplierName: true,
        supplierDomain: true,
        reportingYear: true,
        totalAmount: true,
        unit: true,
        calculationMethod: true,
        notes: true,
        qualityScore: true,
        qualityFlags: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        rejectionReason: true,
        convertedToRecordId: true,
        emissionCategory: { select: { code: true, name: true, scope: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    const hasMore = reports.length > limit;
    const page = hasMore ? reports.slice(0, limit) : reports;

    return NextResponse.json({
      reports: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
