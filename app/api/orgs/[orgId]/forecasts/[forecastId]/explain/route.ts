export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { generateForecastExplanation } from "@/lib/ml/forecast-explainability";

type Params = { params: Promise<{ orgId: string; forecastId: string }> };

/**
 * GET /api/orgs/[orgId]/forecasts/[forecastId]/explain
 * Generate interpretable explanation for a forecast prediction
 * using feature importance analysis and confidence factors.
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
        predictions: true,
        accuracy: true,
        method: true,
        trainingDataPoints: true,
        generatedAt: true,
        metadata: true,
      },
    });

    if (!forecast) {
      return apiError("NOT_FOUND", "Forecast not found", 404);
    }

    // Extract metadata for explanation generation
    const metadata = forecast.metadata as Record<string, unknown> | null;
    const historicalMean = (metadata?.historicalMean as number) || 0;
    const historicalStdDev = (metadata?.historicalStdDev as number) || 1;
    const historicalVolatility = (metadata?.historicalVolatility as number) || 10;
    const predictions = Array.isArray(forecast.predictions) ? forecast.predictions : [];

    // Calculate days since last update
    const lastUpdateDays = Math.floor(
      (Date.now() - new Date(forecast.generatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Extract features from metadata
    const trend = (metadata?.trend as number) || 0;
    const seasonality = (metadata?.seasonality as number) || 0;
    const recentChange = (metadata?.recentChange as number) || 0;
    const volatility = (metadata?.volatility as number) || historicalVolatility;
    const cyclicalPattern = (metadata?.cyclicalPattern as number) || 0;

    // Get average forecast value from predictions
    const forecastedValues = predictions.map((p) => {
      const pred = p as Record<string, unknown>;
      return (pred.forecast as number) || 0;
    });
    const averageForecast = forecastedValues.length > 0
      ? forecastedValues.reduce((a, b) => a + b, 0) / forecastedValues.length
      : historicalMean;

    // Generate explanation
    const explanation = generateForecastExplanation(
      averageForecast,
      historicalMean,
      historicalStdDev,
      forecast.trainingDataPoints,
      parseFloat(String(forecast.accuracy)) || 75,
      forecast.method,
      lastUpdateDays,
      historicalVolatility,
      {
        trend,
        seasonality,
        recentChange,
        volatility,
        cyclicalPattern,
      },
      predictions.map((p) => {
        const pred = p as Record<string, unknown>;
        return { confidence: (pred.confidence as number) || 0.5 };
      })
    );

    return NextResponse.json({
      forecastId,
      explanation,
      metadata: {
        method: forecast.method,
        accuracy: parseFloat(String(forecast.accuracy)),
        trainingDataPoints: forecast.trainingDataPoints,
        generatedAt: forecast.generatedAt,
        forecastType: forecast.forecastType,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
