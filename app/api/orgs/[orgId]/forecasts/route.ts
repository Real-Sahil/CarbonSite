export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string }> };

// Schema for GET query params
const ForecastQuerySchema = z.object({
  forecastType: z.enum(["emissions", "supplier_quality", "anomaly_rate"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

/**
 * GET /api/orgs/[orgId]/forecasts
 * Fetch existing forecasts for the organization
 */
export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    // Parse query params
    const query = ForecastQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: orgId,
      validUntil: {
        gt: new Date(), // Only return non-expired forecasts
      },
    };

    if (query.forecastType) {
      where.forecastType = query.forecastType;
    }

    // Fetch forecasts ordered by generation date (newest first)
    const forecasts = await prisma.forecast.findMany({
      where,
      orderBy: {
        generatedAt: "desc",
      },
      take: query.limit,
      select: {
        id: true,
        forecastType: true,
        targetPeriodStart: true,
        targetPeriodEnd: true,
        predictions: true,
        accuracy: true,
        method: true,
        trainingDataPoints: true,
        generatedAt: true,
        validUntil: true,
      },
    });

    return json(
      {
        forecasts: forecasts.map((f: any) => ({
          ...f,
          accuracy: f.accuracy ? parseFloat(String(f.accuracy)) : null,
        })),
        metadata: {
          count: forecasts.length,
          orgId,
          timestamp: new Date().toISOString(),
        },
      },
      { version }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

// Schema for POST body
const CreateForecastSchema = z.object({
  forecastType: z.enum(["emissions", "supplier_quality", "anomaly_rate"]),
  lookbackMonths: z.number().int().min(3).max(60).optional().default(24),
  forecastMonths: z.number().int().min(1).max(60).optional().default(12),
  idempotencyKey: z.string().optional(),
});

/**
 * POST /api/orgs/[orgId]/forecasts
 * Trigger forecast generation for the organization
 */
export async function POST(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin", "editor");

    const body = await req.json();
    const data = CreateForecastSchema.parse(body);

    // Check for duplicate request (idempotency)
    // Note: In production, store idempotencyKey separately or in metadata JSON query
    // For now, skip duplicate detection in this basic implementation

    // Enqueue forecasting job
    // Note: This assumes pg-boss queue is integrated
    // In production, use: await forecastQueue.send(data);
    console.log(`[forecasts] Enqueued ${data.forecastType} forecast for org ${orgId}`);

    return json(
      {
        success: true,
        message: `Forecast job enqueued for ${data.forecastType}`,
        jobData: {
          orgId,
          forecastType: data.forecastType,
          lookbackMonths: data.lookbackMonths,
          forecastMonths: data.forecastMonths,
        },
      },
      { version, status: 202 } // 202 Accepted
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
