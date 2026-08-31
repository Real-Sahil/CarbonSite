export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

// GET /api/public/supplier-data/[token]/validate — validate data request token
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const dataRequest = await prisma.supplierDataRequest.findUnique({
      where: { token },
      select: {
        id: true,
        organizationId: true,
        organization: { select: { name: true } },
        supplierEmail: true,
        categoryCode: true,
        reportingPeriod: { select: { startDate: true, endDate: true } },
        status: true,
        expiresAt: true,
      },
    });

    if (!dataRequest) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Data request not found or invalid token" },
        { status: 404 }
      );
    }

    if (dataRequest.expiresAt && new Date(dataRequest.expiresAt) < new Date()) {
      return NextResponse.json(
        { code: "EXPIRED", message: "This data request has expired" },
        { status: 410 }
      );
    }

    if (dataRequest.status === "converted" || dataRequest.status === "rejected") {
      return NextResponse.json(
        {
          code: "ALREADY_PROCESSED",
          message: `This data request has already been ${dataRequest.status}`,
        },
        { status: 409 }
      );
    }

    const category = await prisma.emissionCategory.findUnique({
      where: { code: dataRequest.categoryCode },
      select: { code: true, name: true, scope: true },
    });

    return NextResponse.json({
      id: dataRequest.id,
      organizationId: dataRequest.organizationId,
      organizationName: dataRequest.organization.name,
      supplierEmail: dataRequest.supplierEmail,
      emissionCategory: category,
      reportingYear: dataRequest.reportingPeriod.startDate.getFullYear(),
      dueDate: dataRequest.expiresAt.toISOString(),
      status: dataRequest.status,
    });
  } catch (err) {
    console.error("[SupplierDataValidate] Error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Failed to validate data request" },
      { status: 500 }
    );
  }
}
