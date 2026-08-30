export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; forecastId: string }> };

/**
 * GET /api/orgs/[orgId]/forecasts/[forecastId]
 * Retrieve a specific forecast with all details
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId, forecastId } = await params;

    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    const forecast = await prisma.forecast.findFirst({
      where: {
        id: forecastId,
        organizationId: orgId,
      },
      select: {
        id: true,
        forecastType: true,
        targetPeriodStart: true,
        targetPeriodEnd: true,
        predictions: true,
        accuracy: true,
        method: true,
        trainingDataPoints: true,
        metadata: true,
        generatedAt: true,
        validUntil: true,
      },
    });

    if (!forecast) {
      return apiError("NOT_FOUND", "Forecast not found", 404);
    }

    const predictions = Array.isArray(forecast.predictions) ? forecast.predictions : [];
    const formattedPredictions = predictions.map((p) => {
      const pred = p as Record<string, unknown>;
      return {
        date: pred.date,
        forecast: pred.forecast,
        lowerBound: pred.lowerBound,
        upperBound: pred.upperBound,
        confidence: pred.confidence,
      };
    });
    return NextResponse.json({
      id: forecast.id,
      forecastType: forecast.forecastType,
      targetPeriodStart: forecast.targetPeriodStart,
      targetPeriodEnd: forecast.targetPeriodEnd,
      predictions: formattedPredictions,
      accuracy: {
        mape: parseFloat(String(forecast.accuracy)),
      },
      method: forecast.method,
      trainingDataPoints: forecast.trainingDataPoints,
      generatedAt: forecast.generatedAt,
      validUntil: forecast.validUntil,
      isValid: new Date(forecast.validUntil) > new Date(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
