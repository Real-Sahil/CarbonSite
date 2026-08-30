import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";

interface Params {
  params: Promise<{ orgId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const days = parseInt(req.nextUrl.searchParams.get("days") || "30");

    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const emissions = await prisma.emissionCalculation.groupBy({
      by: ["createdAt"],
      where: {
        organizationId: orgId,
        createdAt: { gte: startDate },
      },
      _sum: {
        totalCo2e: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const data = emissions.map((item) => ({
      date: item.createdAt.toISOString().split("T")[0],
      totalCo2e: item._sum.totalCo2e ?? 0,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}
