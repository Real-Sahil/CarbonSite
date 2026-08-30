import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string }> };

const forecastQuerySchema = z.object({
  type: z.enum(["emissions", "supplier_quality", "anomaly_rate"]).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId);

    const { searchParams } = new URL(req.url);
    const { type, limit = 10, offset = 0 } = forecastQuerySchema.parse({
      type: searchParams.get("type"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    const whereClause: any = { organizationId: orgId };
    if (type) whereClause.forecastType = type;

    const forecasts = await prisma.forecast.findMany({
      where: whereClause,
      select: {
        id: true,
        forecastType: true,
        targetPeriodStart: true,
        targetPeriodEnd: true,
        accuracy: true,
        method: true,
        trainingDataPoints: true,
        predictions: true,
        generatedAt: true,
        validUntil: true,
      },
      orderBy: { generatedAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.forecast.count({
      where: whereClause,
    });

    return NextResponse.json({
      data: forecasts,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const body = await req.json();
    const { forecastType, lookbackMonths = 24, forecastMonths = 12 } = z
      .object({
        forecastType: z.enum(["emissions", "supplier_quality", "anomaly_rate"]),
        lookbackMonths: z.number().optional(),
        forecastMonths: z.number().optional(),
      })
      .parse(body);

    const queues = (global as any).boss;
    if (!queues) {
      throw new Error("Job queue not available");
    }

    await queues.send(
      "forecasting",
      { orgId, forecastType, lookbackMonths, forecastMonths },
      { startAfter: 0 }
    );

    return NextResponse.json(
      { message: "Forecast generation queued" },
      { status: 202 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
