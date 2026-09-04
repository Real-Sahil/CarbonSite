/**
 * Background worker for generating emissions forecasts
 * Runs periodically to create time-series predictions
 * Includes explainability for forecast components and feature importance
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { autoForecast } from "@/lib/forecasting/engine";
import { explainForecast } from "@/lib/explainability/forecast-explainer";

interface ForecastPrediction {
  date: string;
  forecast: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

interface ForecastResult {
  predictions: ForecastPrediction[];
  accuracy: number;
  method: string;
  metadata: Record<string, unknown>;
  trainingDataPoints: number;
}

function appOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}

/**
 * Calls the Prophet forecasting function (api/forecast.py, deployed as a
 * Vercel Python Function in this same project) for a genuinely battle-tested
 * seasonal model with real out-of-sample accuracy. Returns null on any
 * failure — missing origin, network error, timeout, insufficient data — so
 * the caller can fall back to the pure-TypeScript engine rather than fail
 * the whole forecast.
 */
async function tryProphetForecast(
  historicalData: Array<{ date: string; value: number }>,
  forecastMonths: number
): Promise<ForecastResult | null> {
  const origin = appOrigin();
  if (!origin) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const res = await fetch(`${origin}/api/forecast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.FORECAST_SERVICE_SECRET
          ? { "X-Forecast-Secret": process.env.FORECAST_SERVICE_SECRET }
          : {}),
      },
      body: JSON.stringify({
        points: historicalData.map((d) => ({ date: d.date, value: d.value })),
        periods: forecastMonths,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.warn(`[forecasting] Prophet service returned ${res.status}, falling back to TS engine`);
      return null;
    }

    return (await res.json()) as ForecastResult;
  } catch (error) {
    console.warn("[forecasting] Prophet service unreachable, falling back to TS engine:", error);
    return null;
  }
}

export interface ForecastingJobData {
  orgId: string;
  forecastType: "emissions" | "supplier_quality" | "anomaly_rate";
  lookbackMonths?: number;
  forecastMonths?: number;
}

/**
 * Process forecasting job: extract historical data and generate predictions
 */
export async function processForecastingJob(
  data: ForecastingJobData
): Promise<void> {
  const { orgId, forecastType, lookbackMonths = 24, forecastMonths = 12 } = data;

  console.log(
    `[forecasting] Generating ${forecastType} forecast for org ${orgId}`
  );

  try {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });

    let historicalData;

    if (forecastType === "emissions") {
      // Aggregate monthly emissions from dashboard aggregates
      historicalData = await getEmissionsHistory(orgId, lookbackMonths);
    } else if (forecastType === "supplier_quality") {
      // Aggregate supplier quality metrics over time
      historicalData = await getSupplierQualityHistory(orgId, lookbackMonths);
    } else if (forecastType === "anomaly_rate") {
      // Track anomaly detection rate over time
      historicalData = await getAnomalyRateHistory(orgId, lookbackMonths);
    }

    if (!historicalData || historicalData.length === 0) {
      console.log(
        `[forecasting] No historical data for ${forecastType} in org ${orgId}`
      );
      return;
    }

    // Prefer Prophet (real seasonal decomposition, cross-validated accuracy)
    // and fall back to the pure-TS engine if the Python service is
    // unreachable or the data is unsuitable for it.
    const forecast =
      (await tryProphetForecast(historicalData, forecastMonths)) ??
      autoForecast(historicalData, forecastMonths);

    // Generate explainability for first prediction (most relevant)
    const historicalValues = historicalData.map((d) => d.value);
    const firstPrediction = forecast.predictions[0];
    const trendSlope = forecast.metadata.trendSlope as number | undefined;
    const seasonalComponent = forecast.metadata.seasonalComponent as number | undefined;

    const explanationMethod =
      forecast.method === "prophet" || forecast.method === "seasonal_decomposition"
        ? forecast.method
        : "exponential_smoothing";

    const explanation = explainForecast(
      historicalValues,
      firstPrediction.forecast,
      trendSlope ? trendSlope * 12 : 0,
      seasonalComponent || 0,
      explanationMethod
    );

    // Calculate validity period (forecasts valid for 30 days)
    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + 30);

    // Calculate forecast period dates
    const targetPeriodStart = new Date(now);
    targetPeriodStart.setMonth(targetPeriodStart.getMonth() + 1);
    targetPeriodStart.setDate(1); // Start of next month

    const targetPeriodEnd = new Date(targetPeriodStart);
    targetPeriodEnd.setMonth(
      targetPeriodEnd.getMonth() + forecastMonths
    );
    targetPeriodEnd.setDate(0); // Last day of forecast period

    // Combine forecast metadata with explainability
    const enrichedMetadata = {
      ...forecast.metadata,
      explanation: {
        summary: explanation.summary,
        components: explanation.components,
        featureImportance: explanation.featureImportance,
        confidenceFactors: explanation.confidenceFactors,
      },
    };

    // Store forecast in database
    await prisma.forecast.upsert({
      where: {
        organizationId_forecastType_targetPeriodStart: {
          organizationId: orgId,
          forecastType,
          targetPeriodStart,
        },
      },
      update: {
        predictions: forecast.predictions as unknown as Prisma.InputJsonValue,
        accuracy: forecast.accuracy,
        modelVersion: "v1.0.0",
        trainingDataPoints: forecast.trainingDataPoints,
        method: forecast.method,
        metadata: enrichedMetadata as unknown as Prisma.InputJsonValue,
        generatedAt: now,
        validUntil,
        updatedAt: now,
      },
      create: {
        organizationId: orgId,
        forecastType,
        targetPeriodStart,
        targetPeriodEnd,
        predictions: forecast.predictions as unknown as Prisma.InputJsonValue,
        accuracy: forecast.accuracy,
        modelVersion: "v1.0.0",
        trainingDataPoints: forecast.trainingDataPoints,
        method: forecast.method,
        metadata: enrichedMetadata as unknown as Prisma.InputJsonValue,
        generatedAt: now,
        validUntil,
      },
    });

    console.log(
      `[forecasting] Completed ${forecastType} forecast for org ${orgId}`
    );
  } catch (error) {
    console.error(
      `[forecasting] Error generating forecast for org ${orgId}:`,
      error
    );
    throw error;
  }
}

/**
 * Extract historical emissions data for forecasting
 */
async function getEmissionsHistory(
  orgId: string,
  months: number
): Promise<Array<{ date: string; value: number }>> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);

  // Get monthly totals from DashboardAggregate via ReportingPeriod
  const aggregates = await prisma.dashboardAggregate.findMany({
    where: {
      organizationId: orgId,
      reportingPeriod: {
        endDate: {
          gte: startDate,
        },
      },
    },
    select: {
      reportingPeriod: {
        select: {
          endDate: true,
        },
      },
      totalCo2e: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Group by reporting period and sum totals
  const monthlyTotals = new Map<string, number>();
  for (const agg of aggregates) {
    const key = agg.reportingPeriod.endDate.toISOString().split("T")[0];
    monthlyTotals.set(
      key,
      (monthlyTotals.get(key) || 0) + parseFloat(String(agg.totalCo2e))
    );
  }

  return Array.from(monthlyTotals.entries())
    .map(([date, value]) => ({
      date,
      value: Math.max(0, value),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Extract supplier quality history for forecasting
 */
async function getSupplierQualityHistory(
  orgId: string,
  months: number
): Promise<Array<{ date: string; value: number }>> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  // Get historical supplier performance
  const histories = await prisma.supplierPerformanceHistory.findMany({
    where: {
      organizationId: orgId,
      recordedAt: {
        gte: startDate,
      },
    },
    select: {
      recordedAt: true,
      dataQualityScore: true,
    },
    orderBy: {
      recordedAt: "asc",
    },
  });

  // Group by month and calculate average quality score
  const monthlyScores = new Map<string, number[]>();

  for (const hist of histories) {
    const monthKey = hist.recordedAt.toISOString().split("T")[0].slice(0, 7);
    if (!monthlyScores.has(monthKey)) {
      monthlyScores.set(monthKey, []);
    }
    monthlyScores.get(monthKey)!.push(parseFloat(String(hist.dataQualityScore)));
  }

  // Average scores per month
  const result: Array<{ date: string; value: number }> = [];
  for (const [month, scores] of monthlyScores.entries()) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    result.push({
      date: `${month}-01`,
      value: avg,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Extract anomaly rate history for forecasting
 */
async function getAnomalyRateHistory(
  orgId: string,
  months: number
): Promise<Array<{ date: string; value: number }>> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  // Get anomaly counts by month
  const anomalies = await prisma.invoiceAnomaly.findMany({
    where: {
      organizationId: orgId,
      createdAt: {
        gte: startDate,
      },
    },
    select: {
      createdAt: true,
    },
  });

  // Group by month and calculate anomaly rate
  const monthlyAnomalyCount = new Map<string, number>();

  for (const anomaly of anomalies) {
    const monthKey = anomaly.createdAt.toISOString().split("T")[0].slice(0, 7);
    monthlyAnomalyCount.set(
      monthKey,
      (monthlyAnomalyCount.get(monthKey) || 0) + 1
    );
  }

  // Convert to anomaly rate (percentage)
  const result: Array<{ date: string; value: number }> = [];
  for (const [month, count] of monthlyAnomalyCount.entries()) {
    result.push({
      date: `${month}-01`,
      value: count > 0 ? Math.min(100, count / 10) : 0, // Normalize to 0-100 scale
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
