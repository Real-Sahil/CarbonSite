export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion } from "@/lib/api/versioned-handler";

type Params = { params: Promise<{ orgId: string; forecastId: string }> };

/**
 * GET /api/orgs/[orgId]/forecasts/[forecastId]/explain
 * Retrieve explainability for a forecast
 * Explains why the forecast has its particular value using feature importance
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId, forecastId } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    // Fetch forecast with explanation metadata
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
        metadata: true,
        generatedAt: true,
      },
    });

    if (!forecast) {
      return apiError("NOT_FOUND", "Forecast not found", 404);
    }

    // Extract explanation from metadata
    const metadata = forecast.metadata as any;
    const explanation = metadata?.explanation;

    if (!explanation) {
      return json(
        {
          error: "Explanation not available for this forecast",
          reason: "Forecast was generated before explainability was added",
          forecastId,
        },
        { version, status: 400 }
      );
    }

    return json(
      {
        forecastId,
        forecastType: forecast.forecastType,
        targetPeriodStart: forecast.targetPeriodStart,
        targetPeriodEnd: forecast.targetPeriodEnd,
        method: forecast.method,
        accuracy: parseFloat(String(forecast.accuracy)),
        generatedAt: forecast.generatedAt,
        explanation: {
          summary: explanation.summary,
          components: explanation.components,
          featureImportance: explanation.featureImportance.map((f: any) => ({
            name: f.name,
            contribution: f.contribution,
            direction: f.direction,
            significance: f.significance,
            explanation: f.explanation,
          })),
          confidenceFactors: explanation.confidenceFactors,
        },
        predictions: (forecast.predictions as any[]).map((p) => ({
          date: p.date,
          forecast: p.forecast,
          lowerBound: p.lowerBound,
          upperBound: p.upperBound,
          confidence: p.confidence,
        })),
      },
      { version }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
