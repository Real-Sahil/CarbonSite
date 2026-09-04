import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSupplierAnalytics, updateSupplierAnalytics, refreshSupplierAnalytics } from "@/lib/integrations/supplier-analytics";
import { getOrgEmissionsTrend } from "@/lib/calculation/trend-analyzer";
import { dispatchForecast } from "@/lib/jobs/dispatch";
import * as ss from 'simple-statistics';

type Params = { params: Promise<{ orgId: string }> };

const forecastQuerySchema = z.object({
  type: z.enum(["emissions", "supplier_quality", "anomaly_rate"]).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
  supplierId: z.string().optional(),
  minScore: z.string().transform(Number).optional(),
  trend: z.enum(["improving", "stable", "declining"]).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId);

    const { searchParams } = new URL(req.url);
    const { type, limit = 50, offset = 0, supplierId, minScore, trend } = forecastQuerySchema.parse({
      type: searchParams.get("type"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      supplierId: searchParams.get("supplierId"),
      minScore: searchParams.get("minScore"),
      trend: searchParams.get("trend"),
    });

    // If requesting supplier analytics (new endpoint)
    if (type === "supplier_quality" || supplierId) {
      const analytics = await getSupplierAnalytics(orgId, {
        supplierId: supplierId || undefined,
        minScore,
        trend,
        limit,
        offset,
      });

      const emissionsTrend = await getOrgEmissionsTrend(orgId, 24);

      const forecastSummary = {
        totalSuppliers: analytics.length,
        avgScore: analytics.length > 0 ? ss.mean(analytics.map((a) => Number(a.overallScore))) : 0,
        improvingCount: analytics.filter((a) => a.trend === "improving").length,
        declineCount: analytics.filter((a) => a.trend === "declining").length,
        totalForecastedEmissions: analytics.reduce((sum, a) => sum + Number(a.forecastedEmissions || 0), 0),
        avgConfidence: analytics.length > 0 ? ss.mean(analytics.map((a) => Number(a.forecastConfidence))) : 0,
        emissionsTrend: emissionsTrend.slice(0, 12).reverse(),
      };

      return NextResponse.json({
        code: "success",
        data: {
          forecasts: analytics,
          summary: forecastSummary,
          pagination: { limit, offset, total: analytics.length },
        },
      });
    }

    // Legacy forecast endpoint
    const whereClause: Prisma.ForecastWhereInput = { organizationId: orgId };
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
    const { forecastType, lookbackMonths = 24, forecastMonths = 12, supplierId, triggerType = "refresh" } = z
      .object({
        forecastType: z.enum(["emissions", "supplier_quality", "anomaly_rate"]).optional(),
        lookbackMonths: z.number().optional(),
        forecastMonths: z.number().optional(),
        supplierId: z.string().optional(),
        triggerType: z.enum(["refresh", "single", "full"]).optional(),
      })
      .parse(body);

    // Handle supplier analytics refresh
    if (forecastType === "supplier_quality") {
      if (triggerType === "single" && !supplierId) {
        return apiError("INVALID_REQUEST", "supplierId required for single forecast", 400);
      }

      let result: unknown;

      if (triggerType === "single" && supplierId) {
        result = await updateSupplierAnalytics(orgId, supplierId);
        return NextResponse.json({
          code: "success",
          message: `Forecast updated for supplier ${supplierId}`,
          data: { supplierId, analytics: result },
        }, { status: 202 });
      } else if (triggerType === "full") {
        const suppliers = await prisma.supplierAnalytic.findMany({
          where: { organizationId: orgId },
          select: { supplierId: true },
        });

        let updateCount = 0;
        const errors: string[] = [];

        for (const { supplierId: sid } of suppliers) {
          if (sid) {
            try {
              await updateSupplierAnalytics(orgId, sid);
              updateCount++;
            } catch (error) {
              errors.push(`${sid}: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
          }
        }

        return NextResponse.json({
          code: errors.length === 0 ? "success" : "partial_success",
          message: errors.length === 0 ? "All forecasts updated" : `${updateCount} updated, ${errors.length} failed`,
          data: { orgId, updated: updateCount, failed: errors.length, errors: errors.length > 0 ? errors.slice(0, 10) : undefined },
        }, { status: 202 });
      } else {
        const updateCount = await refreshSupplierAnalytics(orgId);
        return NextResponse.json({
          code: "success",
          message: `Forecast generation queued for ${updateCount} suppliers`,
          data: { orgId, suppliersQueued: updateCount, status: "queued" },
        }, { status: 202 });
      }
    }

    if (!forecastType) {
      return apiError("INVALID_REQUEST", "forecastType is required", 400);
    }

    // dispatchForecast() runs the job inline when JOB_PROCESSING_MODE is unset
    // or "inline" (the only mode that works on a Vercel-only deployment, since
    // nothing there runs workers/index.ts continuously to drain a queue) and
    // enqueues to pg-boss only when explicitly running a separate worker.
    const result = await dispatchForecast({
      orgId,
      forecastType,
      lookbackMonths,
      forecastMonths,
    });

    return NextResponse.json(
      {
        message: result === "processed" ? "Forecast generated" : "Forecast generation queued",
        status: result,
      },
      { status: 202 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
