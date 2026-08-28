import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

export interface SubmissionData {
  quantity: string | number;
  unit?: string;
  [key: string]: unknown;
}

export interface AnomalyDetectionResult {
  requestId: string;
  anomalyScore: number;
  severity: 'warning' | 'critical';
  reason: string;
  flaggedFields: { field: string; value: unknown; expectedRange?: { min: number; max: number } }[];
  historicalAverage?: number;
  historicalStdDev?: number;
}

/**
 * Detect anomalies in supplier submissions using 3-sigma rule
 */
export async function detectSupplierAnomalies(
  organizationId: string,
  supplierDataRequestId: string,
): Promise<AnomalyDetectionResult | null> {
  const request = await prisma.supplierDataRequest.findUnique({
    where: { id: supplierDataRequestId },
    include: { organization: true },
  });

  if (!request || request.organizationId !== organizationId) {
    return null;
  }

  if (!request.submittedData) {
    return null;
  }

  const submittedData = request.submittedData as SubmissionData;
  const quantity = Number(submittedData.quantity);
  // unit is defined but kept for future use in multi-unit validation

  // Get historical data for this supplier + category
  const historicalSubmissions = await prisma.supplierDataRequest.findMany({
    where: {
      organizationId,
      supplierEmail: request.supplierEmail,
      categoryCode: request.categoryCode,
      status: { in: ['approved', 'converted'] },
      submittedData: { not: { isNull: true } },
    },
    orderBy: { submittedAt: 'desc' },
    take: 20, // Last 20 approved submissions
  });

  if (historicalSubmissions.length < 5) {
    // Not enough data to detect anomalies
    return null;
  }

  // Calculate historical statistics
  const quantities = historicalSubmissions
    .map((s) => Number((s.submittedData as SubmissionData).quantity))
    .filter((q) => !isNaN(q));

  if (quantities.length < 3) {
    return null;
  }

  const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
  const variance = quantities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / quantities.length;
  const stdDev = Math.sqrt(variance);

  // 3-sigma rule: anything outside mean ± 3*stdDev is critical
  // 2-sigma rule: anything outside mean ± 2*stdDev is warning
  const lowerBound2Sigma = mean - 2 * stdDev;
  const upperBound2Sigma = mean + 2 * stdDev;
  const lowerBound3Sigma = mean - 3 * stdDev;
  const upperBound3Sigma = mean + 3 * stdDev;

  const flaggedFields: AnomalyDetectionResult['flaggedFields'] = [];
  let anomalyScore = 0;
  let severity: 'warning' | 'critical' = 'warning';

  if (quantity < lowerBound3Sigma || quantity > upperBound3Sigma) {
    severity = 'critical';
    anomalyScore = 0.9;
    flaggedFields.push({
      field: 'quantity',
      value: quantity,
      expectedRange: { min: mean - 2 * stdDev, max: mean + 2 * stdDev },
    });
  } else if (quantity < lowerBound2Sigma || quantity > upperBound2Sigma) {
    severity = 'warning';
    anomalyScore = 0.6;
    flaggedFields.push({
      field: 'quantity',
      value: quantity,
      expectedRange: { min: mean - 2 * stdDev, max: mean + 2 * stdDev },
    });
  }

  // No anomalies detected
  if (flaggedFields.length === 0) {
    return null;
  }

  const reason =
    severity === 'critical'
      ? `Submission quantity (${quantity}) is significantly outside historical range (mean: ${mean.toFixed(2)}, std dev: ${stdDev.toFixed(2)})`
      : `Submission quantity (${quantity}) is outside normal range (mean: ${mean.toFixed(2)}, std dev: ${stdDev.toFixed(2)})`;

  return {
    requestId: supplierDataRequestId,
    anomalyScore,
    severity,
    reason,
    flaggedFields,
    historicalAverage: mean,
    historicalStdDev: stdDev,
  };
}

/**
 * Persist anomaly detection result to database
 */
export async function saveAnomaly(
  organizationId: string,
  result: AnomalyDetectionResult,
) {
  return prisma.supplierAnomaly.create({
    data: {
      organizationId,
      supplierDataRequestId: result.requestId,
      anomalyScore: new Decimal(result.anomalyScore.toString()),
      anomalySeverity: result.severity,
      reason: result.reason,
      flaggedFields: result.flaggedFields,
      historicalAverage: result.historicalAverage ? new Decimal(result.historicalAverage.toString()) : null,
      historicalStdDev: result.historicalStdDev ? new Decimal(result.historicalStdDev.toString()) : null,
    },
  });
}

/**
 * Acknowledge an anomaly (mark as reviewed)
 */
export async function acknowledgeAnomaly(
  organizationId: string,
  anomalyId: string,
  userId: string,
  note?: string,
) {
  const anomaly = await prisma.supplierAnomaly.findUnique({
    where: { id: anomalyId },
  });

  if (!anomaly || anomaly.organizationId !== organizationId) {
    throw new Error('Anomaly not found or access denied');
  }

  return prisma.supplierAnomaly.update({
    where: { id: anomalyId },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedByUserId: userId,
      acknowledgedNote: note,
    },
  });
}

/**
 * Get unacknowledged anomalies for an organization
 */
export async function getUnacknowledgedAnomalies(
  organizationId: string,
  filters?: { severity?: 'warning' | 'critical' },
) {
  return prisma.supplierAnomaly.findMany({
    where: {
      organizationId,
      acknowledgedAt: null,
      ...(filters?.severity && { anomalySeverity: filters.severity }),
    },
    include: {
      supplierDataRequest: {
        select: {
          id: true,
          supplierEmail: true,
          supplierName: true,
          categoryCode: true,
          submittedData: true,
        },
      },
    },
    orderBy: [{ anomalySeverity: 'desc' }, { anomalyScore: 'desc' }],
  });
}
