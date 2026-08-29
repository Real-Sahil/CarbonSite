import { prisma } from "@/lib/db";

export interface EmissionAnomaly {
  recordId: string;
  category: string;
  anomalyType: "outlier" | "trend_change" | "unusual_pattern";
  severity: "low" | "medium" | "high";
  value: number;
  expectedRange: {
    min: number;
    max: number;
  };
  deviation: number; // % deviation from expected
  message: string;
  recommendation: string;
}

/**
 * Detect statistical outliers in emissions data using Z-score.
 * Records with Z-score > 2 (95% confidence) are flagged.
 */
export async function detectOutliers(
  organizationId: string,
  reportingPeriodId?: string,
  zScoreThreshold: number = 2.0
): Promise<EmissionAnomaly[]> {
  const anomalies: EmissionAnomaly[] = [];

  // Get all calculations with their related activity records
  const calculations = await prisma.emissionCalculation.findMany({
    where: {
      activityRecord: {
        organizationId,
        ...(reportingPeriodId && { reportingPeriodId }),
      },
    },
    include: {
      activityRecord: {
        include: { emissionCategory: true },
      },
    },
  });

  // Group by category in application code
  const categoryMap = new Map<
    string,
    Array<{ id: string; value: number; record: any }>
  >();
  for (const calc of calculations) {
    const catId = calc.activityRecord.emissionCategoryId;
    const value = Number(calc.totalCo2e);

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, []);
    }
    categoryMap.get(catId)!.push({
      id: calc.id,
      value,
      record: calc.activityRecord,
    });
  }

  // Analyze each category for outliers
  for (const [categoryId, records] of categoryMap.entries()) {
    if (records.length < 3) continue; // Need at least 3 data points

    // Calculate mean and std deviation
    const values = records.map((r) => r.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) continue; // No variation

    // Find outliers
    for (let i = 0; i < records.length; i++) {
      const value = values[i];
      const zScore = Math.abs((value - mean) / stdDev);

      if (zScore > zScoreThreshold) {
        const record = records[i].record;
        const deviation = Math.round(((value - mean) / mean) * 100);
        anomalies.push({
          recordId: record.id,
          category: record.emissionCategory?.name || "Unknown",
          anomalyType: "outlier",
          severity: Math.abs(zScore) > 3 ? "high" : "medium",
          value: Math.round(value),
          expectedRange: {
            min: Math.round(mean - stdDev),
            max: Math.round(mean + stdDev),
          },
          deviation,
          message: `Emissions ${deviation > 0 ? "significantly higher" : "significantly lower"} than category average (Z-score: ${zScore.toFixed(2)})`,
          recommendation:
            "Verify the accuracy of this record. Check for data entry errors, exceptional circumstances, or legitimate business variations.",
        });
      }
    }
  }

  return anomalies.sort((a, b) => b.severity.localeCompare(a.severity));
}

/**
 * Detect sudden changes in emissions trends.
 */
export async function detectTrendChanges(
  organizationId: string,
  windowSize: number = 4 // months
): Promise<EmissionAnomaly[]> {
  const anomalies: EmissionAnomaly[] = [];

  // Get monthly emissions data
  const monthlyData = await getMonthlyEmissions(organizationId);

  if (monthlyData.length < windowSize * 2) {
    return anomalies; // Need enough data to detect trends
  }

  // Calculate average rate of change in first window
  const firstWindowChange = calculateTrendSlope(monthlyData.slice(0, windowSize));

  // Calculate recent rate of change
  const recentWindowChange = calculateTrendSlope(
    monthlyData.slice(-windowSize)
  );

  // If trend has reversed or significantly changed
  const trendChange = Math.abs(recentWindowChange - firstWindowChange);
  const avgChange = Math.abs(firstWindowChange);

  if (trendChange > avgChange * 0.5 && avgChange !== 0) {
    const recent = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];

    anomalies.push({
      recordId: "", // This is org-level
      category: "Organization-wide",
      anomalyType: "trend_change",
      severity: recentWindowChange < 0 ? "low" : "high", // Negative = reduction (good)
      value: recent.total,
      expectedRange: {
        min: previous.total - previous.total * 0.2,
        max: previous.total + previous.total * 0.2,
      },
      deviation: Math.round(
        ((recent.total - previous.total) / previous.total) * 100
      ),
      message: `Emissions trend has changed. Recent pattern shows ${recentWindowChange < 0 ? "improvement" : "deterioration"} compared to historical trend.`,
      recommendation: recentWindowChange < 0
        ? "Continue current reduction strategies"
        : "Investigate recent emissions increase and identify contributing factors.",
    });
  }

  return anomalies;
}

/**
 * Detect unusual patterns based on Scope classification.
 */
export async function detectUnusualPatterns(
  organizationId: string
): Promise<EmissionAnomaly[]> {
  const anomalies: EmissionAnomaly[] = [];

  // Get scope breakdown by grouping the data by scope
  const scopeData = await prisma.dashboardAggregate.groupBy({
    by: ["scope"],
    where: { organizationId },
    _sum: {
      totalCo2e: true,
    },
    _count: true,
  });

  if (scopeData.length === 0) return anomalies;

  // Map scope data
  const scopeMap = new Map<number, { total: number; count: number }>();
  let total = 0;
  for (const entry of scopeData) {
    const sum = Number(entry._sum.totalCo2e ?? 0);
    scopeMap.set(entry.scope, { total: sum, count: entry._count });
    total += sum;
  }

  const scope1 = scopeMap.get(1)?.total ?? 0;
  const scope2 = scopeMap.get(2)?.total ?? 0;
  const scope3 = scopeMap.get(3)?.total ?? 0;

  if (total === 0) return anomalies;

  // Detect if Scope 3 is unusually low (often underreported)
  const scope3Percent = (scope3 / total) * 100;
  if (scope3Percent < 20) {
    anomalies.push({
      recordId: "",
      category: "Scope 3 Coverage",
      anomalyType: "unusual_pattern",
      severity: "medium",
      value: scope3,
      expectedRange: {
        min: Math.round(total * 0.2),
        max: Math.round(total * 0.7),
      },
      deviation: -Math.round((1 - scope3Percent / 30) * 100),
      message: `Scope 3 emissions account for only ${scope3Percent.toFixed(0)}% of total. This is often underreported.`,
      recommendation: "Review Scope 3 categories (business travel, commuting, purchased goods, upstream transport) for completeness.",
    });
  }

  // Detect if Scope 1 is unusually high
  const scope1Percent = (scope1 / total) * 100;
  if (scope1Percent > 60) {
    anomalies.push({
      recordId: "",
      category: "Scope 1 Distribution",
      anomalyType: "unusual_pattern",
      severity: "low",
      value: scope1,
      expectedRange: {
        min: Math.round(total * 0.1),
        max: Math.round(total * 0.5),
      },
      deviation: Math.round((scope1Percent / 30 - 1) * 100),
      message: `Scope 1 emissions are unusually high at ${scope1Percent.toFixed(0)}% of total.`,
      recommendation: "Verify direct emissions (fuel, fugitive) are accurately captured and classified.",
    });
  }

  return anomalies;
}

/**
 * Get monthly emissions summary for trend analysis.
 */
async function getMonthlyEmissions(
  organizationId: string,
  months: number = 12
): Promise<Array<{ month: Date; total: number }>> {
  const data: Array<{ month: Date; total: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const result = await prisma.dashboardAggregate.aggregate({
      where: {
        organizationId,
        reportingPeriod: {
          startDate: { gte: monthStart },
          endDate: { lte: monthEnd },
        },
      },
      _sum: {
        totalCo2e: true,
      },
    });

    const total = Number(result._sum.totalCo2e ?? 0);
    data.push({ month: monthStart, total });
  }

  return data;
}

/**
 * Calculate trend slope for a data series (simple linear regression).
 */
function calculateTrendSlope(data: Array<{ month: Date; total: number }>): number {
  if (data.length < 2) return 0;

  const n = data.length;
  const sumX = Array.from({ length: n }, (_, i) => i).reduce((a, b) => a + b);
  const sumY = data.reduce((sum, d) => sum + d.total, 0);
  const sumXY = data.reduce((sum, d, i) => sum + i * d.total, 0);
  const sumX2 = Array.from({ length: n }, (_, i) => i * i).reduce((a, b) => a + b);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

/**
 * Comprehensive anomaly report.
 */
export async function generateAnomalyReport(
  organizationId: string
): Promise<{
  outliers: EmissionAnomaly[];
  trendChanges: EmissionAnomaly[];
  patterns: EmissionAnomaly[];
  totalAnomalies: number;
  riskLevel: "low" | "medium" | "high";
}> {
  const [outliers, trendChanges, patterns] = await Promise.all([
    detectOutliers(organizationId),
    detectTrendChanges(organizationId),
    detectUnusualPatterns(organizationId),
  ]);

  const allAnomalies = [...outliers, ...trendChanges, ...patterns];
  const criticalCount = allAnomalies.filter((a) => a.severity === "high").length;

  return {
    outliers: outliers.slice(0, 5),
    trendChanges,
    patterns,
    totalAnomalies: allAnomalies.length,
    riskLevel:
      criticalCount > 5 ? "high" : criticalCount > 2 ? "medium" : "low",
  };
}
