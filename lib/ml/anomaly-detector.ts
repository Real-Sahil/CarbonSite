/**
 * Anomaly Detection for Emissions Data via Statistical Methods
 *
 * Detects unusual emission values (outliers) before they're committed.
 * Uses statistical methods to identify records that deviate significantly from patterns.
 * Helps catch data entry errors, unit conversion mistakes, and suspicious submissions.
 */

import { prisma } from "@/lib/db";

export interface AnomalyScore {
  recordId: string;
  isAnomaly: boolean;
  anomalyScore: number; // 0-1, higher = more anomalous
  flagReason: string; // e.g., "value >3σ from mean", "isolation score 0.95"
  suggestedAction: string; // e.g., "verify_unit", "review_with_submitter", "approve_as_is"
}

export interface AnomalyDetectionResult {
  totalRecords: number;
  anomalousRecords: number;
  anomalies: AnomalyScore[];
  overallQuality: number; // 0-100, based on % normal records
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'toNumber' in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return Number(val);
}

/**
 * Detect anomalies in a batch of activity records using statistical methods
 * Compares each record against historical facility/category patterns
 */
export async function detectAnomaliesInBatch(
  orgId: string,
  recordIds: string[]
): Promise<AnomalyDetectionResult> {
  try {
    // 1. Fetch the records to analyze
    const records = await prisma.activityRecord.findMany({
      where: {
        id: { in: recordIds },
        organizationId: orgId,
      },
    });

    if (records.length === 0) {
      return {
        totalRecords: 0,
        anomalousRecords: 0,
        anomalies: [],
        overallQuality: 100,
      };
    }

    // 2. For each facility + category combo, fetch historical data to compute baseline stats
    const anomalies: AnomalyScore[] = [];

    for (const record of records) {
      const historicalRecords = await prisma.activityRecord.findMany({
        where: {
          organizationId: orgId,
          facilityId: record.facilityId,
          emissionCategoryId: record.emissionCategoryId,
          reviewStatus: "approved",
          id: { not: record.id },
          activityDate: {
            gte: new Date(new Date().getTime() - 365 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          amount: true,
        },
        take: 100,
      });

      // 3. Calculate statistics from historical data
      if (historicalRecords.length < 5) {
        continue;
      }

      const historicalValues = historicalRecords.map((r) => toNumber(r.amount));

      const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
      const variance =
        historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        historicalValues.length;
      const stdev = Math.sqrt(variance);

      // 4. Get record amount
      const recordAmount = toNumber(record.amount);

      // 5. Calculate z-score and anomaly indicators
      const zScore = stdev > 0 ? Math.abs((recordAmount - mean) / stdev) : 0;
      const percentDeviation = mean > 0 ? Math.abs((recordAmount - mean) / mean) : 0;

      // 6. Determine if anomalous using multiple criteria
      let isAnomaly = false;
      let flagReason = "";
      let anomalyScore = 0;
      let suggestedAction = "approve_as_is";

      if (zScore > 3) {
        isAnomaly = true;
        flagReason = `Value is ${zScore.toFixed(2)}σ from facility/category mean`;
        anomalyScore = Math.min(zScore / 5, 1);
        suggestedAction = "review_with_submitter";
      } else if (zScore > 2.5) {
        isAnomaly = true;
        flagReason = `Value is ${zScore.toFixed(2)}σ from facility/category mean (borderline)`;
        anomalyScore = 0.75;
        suggestedAction = "verify_reasonableness";
      } else if (percentDeviation > 5 && recordAmount > mean * 1.5) {
        isAnomaly = true;
        flagReason = `${(percentDeviation * 100).toFixed(0)}% above historical average`;
        anomalyScore = Math.min(percentDeviation, 1);
        suggestedAction = "verify_unit";
      } else if (recordAmount > mean * 10) {
        isAnomaly = true;
        flagReason = `Value is ${(recordAmount / mean).toFixed(1)}x facility average`;
        anomalyScore = 0.95;
        suggestedAction = "review_with_submitter";
      } else if (recordAmount < 0.001 && recordAmount > 0) {
        isAnomaly = true;
        flagReason = "Extremely small value (likely unit conversion error)";
        anomalyScore = 0.8;
        suggestedAction = "verify_unit";
      }

      if (isAnomaly) {
        anomalies.push({
          recordId: record.id,
          isAnomaly,
          anomalyScore,
          flagReason,
          suggestedAction,
        });
      }
    }

    const overallQuality = Math.round(
      ((records.length - anomalies.length) / records.length) * 100
    );

    return {
      totalRecords: records.length,
      anomalousRecords: anomalies.length,
      anomalies: anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore),
      overallQuality,
    };
  } catch (error) {
    console.error(
      `[anomaly-detection] Failed to detect anomalies: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      totalRecords: 0,
      anomalousRecords: 0,
      anomalies: [],
      overallQuality: 0,
    };
  }
}

/**
 * Detect anomalies in a single facility over time
 * Helps identify trend breaks or seasonal shifts
 */
export async function detectFacilityTrendAnomalies(
  orgId: string,
  facilityId: string,
  timeWindowDays: number = 90
): Promise<AnomalyDetectionResult> {
  try {
    const cutoffDate = new Date(new Date().getTime() - timeWindowDays * 24 * 60 * 60 * 1000);

    const recentRecords = await prisma.activityRecord.findMany({
      where: {
        organizationId: orgId,
        facilityId,
        activityDate: { gte: cutoffDate },
        reviewStatus: "approved",
      },
      select: {
        id: true,
        amount: true,
        emissionCategoryId: true,
        activityDate: true,
      },
      orderBy: { activityDate: "asc" },
      take: 200,
    });

    if (recentRecords.length === 0) {
      return {
        totalRecords: 0,
        anomalousRecords: 0,
        anomalies: [],
        overallQuality: 100,
      };
    }

    const recordsByCategory = new Map<
      string,
      Array<{ id: string; amount: number; date: Date }>
    >();

    for (const rec of recentRecords) {
      if (!rec.activityDate) continue;

      const categoryId = rec.emissionCategoryId;
      const amount = toNumber(rec.amount);

      if (!recordsByCategory.has(categoryId)) {
        recordsByCategory.set(categoryId, []);
      }
      recordsByCategory.get(categoryId)!.push({
        id: rec.id,
        amount,
        date: rec.activityDate,
      });
    }

    const anomalies: AnomalyScore[] = [];

    for (const [, categoryRecords] of recordsByCategory.entries()) {
      if (categoryRecords.length < 3) continue;

      const sortedRecords = categoryRecords.sort((a, b) => a.date.getTime() - b.date.getTime());
      const rollingAverages = [];

      for (let i = 0; i < sortedRecords.length; i++) {
        const windowStart = i > 0 ? Math.max(0, i - 6) : 0;
        const windowRecords = sortedRecords.slice(windowStart, i + 1);
        const avg = windowRecords.reduce((sum, r) => sum + r.amount, 0) / windowRecords.length;
        rollingAverages.push(avg);
      }

      for (let i = 0; i < sortedRecords.length; i++) {
        const record = sortedRecords[i];
        const rollingAvg = rollingAverages[i] || 0;
        if (rollingAvg === 0) continue;

        const deviation = Math.abs(record.amount - rollingAvg) / rollingAvg;

        if (deviation > 2) {
          anomalies.push({
            recordId: record.id,
            isAnomaly: true,
            anomalyScore: Math.min(deviation / 3, 1),
            flagReason: `${(deviation * 100).toFixed(0)}% deviation from 7-day average`,
            suggestedAction: deviation > 3 ? "review_with_submitter" : "verify_reasonableness",
          });
        }
      }
    }

    const overallQuality = Math.round(
      ((recentRecords.length - anomalies.length) / recentRecords.length) * 100
    );

    return {
      totalRecords: recentRecords.length,
      anomalousRecords: anomalies.length,
      anomalies: anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore),
      overallQuality,
    };
  } catch (error) {
    console.error(
      `[anomaly-detection] Failed to detect trend anomalies: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      totalRecords: 0,
      anomalousRecords: 0,
      anomalies: [],
      overallQuality: 0,
    };
  }
}

/**
 * Detect duplicate or near-duplicate records (data quality check)
 * Finds records with same facility/category/date/amount within tolerance
 */
export async function detectDuplicateRecords(
  orgId: string,
  facilityId: string,
  tolerancePercent: number = 5
): Promise<Array<{ recordId1: string; recordId2: string; similarity: number }>> {
  try {
    const records = await prisma.activityRecord.findMany({
      where: {
        organizationId: orgId,
        facilityId,
        reviewStatus: "approved",
      },
      select: {
        id: true,
        amount: true,
        emissionCategoryId: true,
        activityDate: true,
      },
      take: 500,
    });

    const duplicates: Array<{ recordId1: string; recordId2: string; similarity: number }> = [];

    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        const r1 = records[i];
        const r2 = records[j];

        const sameCategory = r1.emissionCategoryId === r2.emissionCategoryId;
        if (!r1.activityDate || !r2.activityDate) continue;

        const datesDiff = Math.abs(r1.activityDate.getTime() - r2.activityDate.getTime());
        const sameDateWindow = datesDiff < 24 * 60 * 60 * 1000;

        if (!sameCategory || !sameDateWindow) continue;

        const amt1 = toNumber(r1.amount);
        const amt2 = toNumber(r2.amount);

        const amountDiff = Math.abs(amt1 - amt2) / Math.max(amt1, amt2, 0.001);
        if (amountDiff <= tolerancePercent / 100) {
          duplicates.push({
            recordId1: r1.id,
            recordId2: r2.id,
            similarity: 1 - amountDiff,
          });
        }
      }
    }

    return duplicates.sort((a, b) => b.similarity - a.similarity);
  } catch (error) {
    console.error(
      `[anomaly-detection] Failed to detect duplicates: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}
