import { prisma } from '@/lib/db';
import type { Decimal } from '@prisma/client/runtime/library';

interface AnomalyResult {
  recordId: string;
  isAnomaly: boolean;
  anomalyScore: number; // 0-1, higher = more anomalous
  reason?: string;
}

export async function detectAnomalies(
  orgId: string,
  categoryId: string,
  records: Array<{ id: string; amount: number | Decimal | unknown; unit: string }>,
): Promise<AnomalyResult[]> {
  if (records.length === 0) return [];

  // Get historical statistics for this category
  const historicalRecords = await prisma.activityRecord.findMany({
    where: {
      organizationId: orgId,
      emissionCategoryId: categoryId,
      reviewStatus: 'approved',
    },
    select: { amount: true },
    take: 100,
  });

  if (historicalRecords.length < 5) {
    return records.map((r) => ({
      recordId: r.id,
      isAnomaly: false,
      anomalyScore: 0,
    }));
  }

  const historicalAmounts = historicalRecords.map((r) => Number(r.amount));
  const stats = calculateStats(historicalAmounts);

  return records.map((record) => {
    const zScore = Math.abs((Number(record.amount) - stats.mean) / (stats.stdDev || 1));
    const isOutlier = zScore > 3; // 3 standard deviations

    // Check for extreme outliers (>10x or <0.1x median)
    const medianRatio = Number(record.amount) / (stats.median || 1);
    const isExtremeOutlier = medianRatio > 10 || (medianRatio > 0 && medianRatio < 0.1);

    const anomalyScore = Math.min(1, zScore / 10);

    return {
      recordId: record.id,
      isAnomaly: isOutlier || isExtremeOutlier,
      anomalyScore,
      reason: isExtremeOutlier
        ? `Value ${Number(record.amount).toFixed(2)} is extreme compared to historical median of ${stats.median?.toFixed(2)}`
        : isOutlier
          ? `Value is ${zScore.toFixed(1)} standard deviations from mean`
          : undefined,
    };
  });
}

function calculateStats(values: number[]): {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

export async function flagAnomalies(
  orgId: string,
  categoryId: string,
  recordIds: string[],
): Promise<void> {
  if (recordIds.length === 0) return;

  const records = await prisma.activityRecord.findMany({
    where: { id: { in: recordIds }, organizationId: orgId },
    select: { id: true, amount: true, unit: true },
  });

  const anomalies = await detectAnomalies(orgId, categoryId, records);
  const flaggedIds = anomalies.filter((a) => a.isAnomaly).map((a) => a.recordId);

  if (flaggedIds.length > 0) {
    console.warn(`[anomaly-detector] Flagged ${flaggedIds.length} anomalies for category ${categoryId}`);
  }
}
