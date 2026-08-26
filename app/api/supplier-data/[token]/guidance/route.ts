export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCategoryGuidance } from "@/lib/suppliers/category-guidance";

type Params = { params: Promise<{ token: string }> };

// GET /api/supplier-data/[token]/guidance — get category guidance for supplier
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const request = await prisma.supplierDataRequest.findUnique({
      where: { token },
      select: {
        categoryCode: true,
        expiresAt: true,
        status: true,
      },
    });

    if (!request) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Request not found." },
        { status: 404 },
      );
    }

    const now = new Date();
    if (request.expiresAt <= now) {
      return NextResponse.json(
        { code: "EXPIRED", message: "This data request has expired." },
        { status: 410 },
      );
    }

    // Return guidance for the category
    const guidance = getCategoryGuidance(request.categoryCode);
    if (!guidance) {
      return NextResponse.json(
        {
          code: "CATEGORY_NOT_FOUND",
          message: `Guidance not available for category ${request.categoryCode}.`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      categoryCode: guidance.categoryCode,
      categoryName: guidance.categoryName,
      description: guidance.description,
      whatToInclude: guidance.whatToInclude,
      whatToExclude: guidance.whatToExclude,
      unitGuidance: guidance.unitGuidance,
      calculationTip: guidance.calculationTip,
      commonMistakes: guidance.commonMistakes,
      resources: guidance.resources,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message },
      { status: 500 },
    );
  }
}
