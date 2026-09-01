import { prisma } from '@/lib/db';
import * as ss from 'simple-statistics';
import { ensembleForecast, calculateForecastAccuracy } from '@/lib/calculation/forecaster';
import { getScope3Growth, detectFacilityAnomalies } from '@/lib/calculation/trend-analyzer';

interface SupplierScore {
  organizationId: string;
  supplierId: string;
  submissionCount: number;
  approvalRate: number; // 0-1
  completenessScore: number; // 0-100
  timelinessScore: number; // 0-100
  overallScore: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  previousScore: number;
  scoreChange: number;
}

interface SupplierEmissionForecast {
  supplierId: string;
  forecastedEmissions: number[]; // 12-month forecast in tonnes CO2e
  confidenceScore: number; // 0-1
  confidenceInterval: {
    lower: number[];
    upper: number[];
  };
}

interface SupplierAnomaly {
  submissionId: string;
  supplierId: string;
  anomalyType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  detectedAt: Date;
}

/**
 * Calculate composite supplier performance score
 * Weighs: completeness (30%), accuracy (50%), timeliness (20%)
 */
export async function calculateSupplierScore(
  organizationId: string,
  supplierId: string,
  lookbackMonths: number = 12
): Promise<SupplierScore> {
  // Fetch historical performance data for trend analysis
  const submissions = await prisma.fieldSubmission.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: new Date(Date.now() - lookbackMonths * 30 * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100, // Limit to recent submissions
  });

  if (submissions.length === 0) {
    return {
      organizationId,
      supplierId,
      submissionCount: 0,
      approvalRate: 0,
      completenessScore: 0,
      timelinessScore: 0,
      overallScore: 0,
      trend: 'stable',
      previousScore: 0,
      scoreChange: 0,
    };
  }

  // 1. Approval Rate (% approved)
  const approved = submissions.filter((s) => s.status === 'approved').length;
  const approvalRate = submissions.length > 0 ? approved / submissions.length : 0;

  // 2. Completeness Score (% of required fields populated)
  let totalCompleteness = 0;
  submissions.forEach((sub) => {
    let filledFields = 0;
    let totalFields = 6;

    // Extract data from JSON fields
    const formData = sub.formData as any;
    const ocrData = sub.ocrExtractedData as any;

    // Check required fields per submission type
    if (formData?.normalizedAmount || ocrData?.weight) filledFields++;
    if (formData?.activityDate || ocrData?.date) filledFields++;
    if (formData?.emissionCategoryId) filledFields++;
    if (formData?.facilityId) filledFields++;
    if (formData?.businessUnitId) filledFields++;
    if (formData?.sourceDescription) filledFields++;

    totalCompleteness += (filledFields / totalFields) * 100;
  });

  const completenessScore = submissions.length > 0 ? totalCompleteness / submissions.length : 0;

  // 3. Timeliness Score (% submitted on or before deadline)
  let onTimeCount = 0;
  const deadlineDays = 7;

  submissions.forEach((sub) => {
    if (sub.requestedByDeadline && sub.submittedAt) {
      // Check if submitted on time relative to deadline
      const daysToSubmit = (sub.submittedAt.getTime() - sub.requestedByDeadline.getTime()) / (1000 * 60 * 60 * 24);
      if (daysToSubmit <= 0) onTimeCount++;
    } else if (sub.submittedAt && sub.createdAt) {
      // Check if submitted within default deadline (7 days)
      const daysToSubmit = (sub.submittedAt.getTime() - sub.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysToSubmit <= deadlineDays) onTimeCount++;
    }
  });

  const timelinessScore = submissions.length > 0 ? (onTimeCount / submissions.length) * 100 : 0;

  // 4. Composite Overall Score
  // Weights: completeness 30%, accuracy (via approval rate) 50%, timeliness 20%
  const overallScore = completenessScore * 0.3 + approvalRate * 100 * 0.5 + timelinessScore * 0.2;

  // 5. Trend detection (comparing last 2 months to prior 2 months)
  const twoMonthsAgo = new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000);
  const fourMonthsAgo = new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000);

  const recentSubs = submissions.filter((s) => s.createdAt > twoMonthsAgo);
  const priorSubs = submissions.filter((s) => s.createdAt > fourMonthsAgo && s.createdAt <= twoMonthsAgo);

  let recentScore = 0;
  let priorScore = 0;

  if (recentSubs.length > 0) {
    const recentApprovalRate = recentSubs.filter((s) => s.status === 'approved').length / recentSubs.length;
    recentScore = recentApprovalRate * 100;
  }

  if (priorSubs.length > 0) {
    const priorApprovalRate = priorSubs.filter((s) => s.status === 'approved').length / priorSubs.length;
    priorScore = priorApprovalRate * 100;
  }

  const scoreChange = recentScore - priorScore;
  let trend: 'improving' | 'stable' | 'declining' = 'stable';

  if (scoreChange > 5) {
    trend = 'improving';
  } else if (scoreChange < -5) {
    trend = 'declining';
  }

  // Fetch previous score from database
  const previousAnalytic = await prisma.supplierAnalytic.findUnique({
    where: {
      organizationId_supplierId: { organizationId, supplierId },
    },
  });

  const previousScore = previousAnalytic?.overallScore ? Number(previousAnalytic.overallScore) : overallScore;
  const finalOverallScore = Math.min(100, Math.max(0, overallScore));

  return {
    organizationId,
    supplierId,
    submissionCount: submissions.length,
    approvalRate,
    completenessScore,
    timelinessScore,
    overallScore: finalOverallScore,
    trend,
    previousScore,
    scoreChange: finalOverallScore - previousScore,
  };
}

/**
 * Forecast supplier emissions based on historical spend trends
 * Applies Scope 3 spend-to-emissions conversion factor
 */
export async function forecastSupplierEmissions(
  organizationId: string,
  supplierId: string,
  forecastMonths: number = 12
): Promise<SupplierEmissionForecast> {
  // Fetch historical spend-based Scope 3 data
  const scope3Data = await getScope3Growth(organizationId, supplierId);

  if (!scope3Data || scope3Data.length === 0) {
    return {
      supplierId,
      forecastedEmissions: Array(forecastMonths).fill(0),
      confidenceScore: 0.3,
      confidenceInterval: {
        lower: Array(forecastMonths).fill(0),
        upper: Array(forecastMonths).fill(0),
      },
    };
  }

  // Convert quarterly spend to monthly estimates for forecasting
  const monthlySpend: number[] = [];

  scope3Data.forEach((quarter, index) => {
    // Average spend per month in the quarter
    const monthlyValue = (quarter.totalSpendGbp || 0) / 3;

    // Fill 3 months per quarter
    for (let m = 0; m < 3; m++) {
      monthlySpend.push(monthlyValue);
    }
  });

  if (monthlySpend.length < 3) {
    return {
      supplierId,
      forecastedEmissions: Array(forecastMonths).fill(ss.mean(monthlySpend)),
      confidenceScore: 0.4,
      confidenceInterval: {
        lower: Array(forecastMonths).fill(0),
        upper: Array(forecastMonths).fill(ss.mean(monthlySpend) * 1.5),
      },
    };
  }

  // Forecast spend using ensemble method
  const spendForecast = ensembleForecast(monthlySpend, forecastMonths);

  // Convert spend to emissions using average Scope 3 emissions factor
  // Typical supplier: 0.0005 tonnes CO2e per GBP spend (varies by sector)
  const emissionsFactor = 0.0005;

  const forecastedEmissions = spendForecast.forecast.map((spend) => spend * emissionsFactor);
  const lowerBound = spendForecast.confidenceInterval.lower.map((spend) => spend * emissionsFactor);
  const upperBound = spendForecast.confidenceInterval.upper.map((spend) => spend * emissionsFactor);

  return {
    supplierId,
    forecastedEmissions,
    confidenceScore: spendForecast.confidence,
    confidenceInterval: {
      lower: lowerBound,
      upper: upperBound,
    },
  };
}

/**
 * Detect anomalies in supplier submission patterns
 * Uses Z-score detection on submission values and frequency
 */
export async function detectSupplierAnomalies(
  organizationId: string,
  supplierId: string,
  stddevThreshold: number = 2
): Promise<SupplierAnomaly[]> {
  // Fetch recent submissions for the organization
  // Note: supplierId filtering would require a supplier_id field on FieldSubmission
  // For now, analyzing org-wide submissions
  const submissions = await prisma.fieldSubmission.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500, // Limit to most recent submissions
  });

  const anomalies: SupplierAnomaly[] = [];

  if (submissions.length < 3) {
    return anomalies; // Need minimum data for anomaly detection
  }

  // Extract emission values from submissions, keeping track of valid indices
  // Try to extract from formData JSON or ocrExtractedData
  const emissionValueMap = new Map<number, number>(); // submissionIndex -> value
  submissions.forEach((sub, index) => {
    const formData = sub.formData as any;
    const ocrData = sub.ocrExtractedData as any;
    const value = (formData?.normalizedAmount || ocrData?.weight || 0) as number;
    if (value > 0) {
      emissionValueMap.set(index, value);
    }
  });

  const emissionValues = Array.from(emissionValueMap.values());

  if (emissionValues.length < 3) {
    return anomalies;
  }

  // Calculate Z-scores
  const mean = ss.mean(emissionValues);
  const stddev = ss.standardDeviation(emissionValues);

  // Only flag anomalies if there is actual variance in the data
  if (stddev > 0) {
    submissions.forEach((sub, index) => {
      const value = emissionValueMap.get(index);
      if (!value) return;

      const zScore = Math.abs((value - mean) / stddev);

      if (zScore > stddevThreshold) {
        let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
        let reason = '';

        if (zScore > 3) {
          severity = 'critical';
          reason = `Value ${value.toFixed(2)} is ${zScore.toFixed(1)}σ from baseline (${mean.toFixed(2)})`;
        } else if (zScore > 2.5) {
          severity = 'high';
          reason = `Value ${value.toFixed(2)} deviates significantly from baseline`;
        } else if (zScore > 2) {
          severity = 'medium';
          reason = `Value ${value.toFixed(2)} is above typical range`;
        }

        anomalies.push({
          submissionId: sub.id,
          supplierId,
          anomalyType: 'value_outlier',
          severity,
          reason,
          detectedAt: new Date(),
        });
      }
    });
  }

  // Detect submission frequency anomalies
  const submissionDates = submissions.map((s) => s.createdAt.getTime());
  const intervals: number[] = [];

  for (let i = 1; i < submissionDates.length; i++) {
    intervals.push((submissionDates[i - 1] - submissionDates[i]) / (1000 * 60 * 60 * 24)); // Days between
  }

  if (intervals.length > 2) {
    const intervalMean = ss.mean(intervals);
    const intervalStddev = ss.standardDeviation(intervals);

    // Only flag frequency anomalies if there is actual variance in submission intervals
    if (intervalStddev > 0) {
      // Check most recent submission for frequency anomaly
      if (submissions.length >= 2) {
        const recentInterval = intervals[0];
        const frequencyZScore = Math.abs((recentInterval - intervalMean) / intervalStddev);

        if (frequencyZScore > stddevThreshold) {
          anomalies.push({
            submissionId: submissions[0].id,
            supplierId,
            anomalyType: 'frequency_anomaly',
            severity: frequencyZScore > 3 ? 'high' : 'medium',
            reason: `Submission frequency changed: ${recentInterval.toFixed(1)} days vs. typical ${intervalMean.toFixed(1)} days`,
            detectedAt: new Date(),
          });
        }
      }
    }
  }

  return anomalies;
}

/**
 * Get stored supplier analytics from database
 */
export async function getSupplierAnalytics(
  organizationId: string,
  options?: {
    supplierId?: string;
    minScore?: number;
    trend?: 'improving' | 'stable' | 'declining';
    limit?: number;
    offset?: number;
  }
) {
  const where: any = { organizationId };

  if (options?.supplierId) {
    where.supplierId = options.supplierId;
  }

  if (options?.minScore !== undefined) {
    where.overallScore = { gte: options.minScore };
  }

  if (options?.trend) {
    where.trend = options.trend;
  }

  return prisma.supplierAnalytic.findMany({
    where,
    orderBy: { overallScore: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });
}

/**
 * Update stored supplier analytics with calculated scores and forecasts
 */
export async function updateSupplierAnalytics(
  organizationId: string,
  supplierId: string
): Promise<any> {
  const score = await calculateSupplierScore(organizationId, supplierId);
  const forecast = await forecastSupplierEmissions(organizationId, supplierId);

  return prisma.supplierAnalytic.upsert({
    where: {
      organizationId_supplierId: { organizationId, supplierId },
    },
    create: {
      organizationId,
      supplierId,
      submissionCount: score.submissionCount,
      approvalRate: score.approvalRate,
      completenessScore: score.completenessScore,
      timelinessScore: score.timelinessScore,
      overallScore: score.overallScore,
      trend: score.trend,
      previousScore: score.previousScore,
      scoreChange: score.scoreChange,
      forecastedEmissions: forecast.forecastedEmissions[0] || 0, // Next month forecast
      forecastConfidence: forecast.confidenceScore,
      anomalyCount: 0,
      updatedAt: new Date(),
    },
    update: {
      submissionCount: score.submissionCount,
      approvalRate: score.approvalRate,
      completenessScore: score.completenessScore,
      timelinessScore: score.timelinessScore,
      overallScore: score.overallScore,
      trend: score.trend,
      previousScore: score.previousScore,
      scoreChange: score.scoreChange,
      forecastedEmissions: forecast.forecastedEmissions[0] || 0,
      forecastConfidence: forecast.confidenceScore,
      updatedAt: new Date(),
    },
  });
}

/**
 * Batch update analytics for all suppliers in organization
 */
export async function refreshSupplierAnalytics(organizationId: string): Promise<number> {
  // Get all unique suppliers from SupplierAnalytic table
  const suppliers = await prisma.supplierAnalytic.findMany({
    where: { organizationId },
    distinct: ['supplierId'],
    select: { supplierId: true },
  });

  let updatedCount = 0;

  for (const { supplierId } of suppliers) {
    try {
      await updateSupplierAnalytics(organizationId, supplierId);
      updatedCount++;
    } catch (error) {
      console.error(`Failed to update analytics for supplier ${supplierId}:`, error);
    }
  }

  return updatedCount;
}
