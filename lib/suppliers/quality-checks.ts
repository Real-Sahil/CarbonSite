import { mean, standardDeviation } from 'simple-statistics';
import { prisma } from '@/lib/db';

interface SubmittedData {
  quantity?: number;
  unit?: string;
  [key: string]: unknown;
}

export interface QualityFlag {
  type: 'outlier' | 'duplicate' | 'unit_mismatch' | 'zero_value' | 'extreme_change';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestedValue?: number;
  suggestedRange?: { min: number; max: number };
}

export interface QualityCheckResult {
  flags: QualityFlag[];
  approved: boolean;
  suggestedQuantity?: number;
}

interface HistoricalRecord {
  quantity: number;
  unit: string;
  categoryCode: string;
}

async function getOrgHistory(
  organizationId: string,
  categoryCode: string,
  excludeRequestId: string
): Promise<HistoricalRecord[]> {
  const requests = await prisma.supplierDataRequest.findMany({
    where: {
      organizationId,
      categoryCode,
      status: 'submitted',
      id: { not: excludeRequestId },
    },
    select: {
      submittedData: true,
    },
  });

  return requests
    .filter((r) => r.submittedData)
    .map((r) => ({
      quantity: (r.submittedData as SubmittedData).quantity || 0,
      unit: (r.submittedData as SubmittedData).unit || '',
      categoryCode,
    }))
    .filter((r) => r.quantity > 0);
}

async function checkForDuplicates(
  organizationId: string,
  supplierEmail: string,
  reportingPeriodId: string,
  categoryCode: string,
  quantity: number,
  excludeRequestId: string
): Promise<QualityFlag | null> {
  const recent = await prisma.supplierDataRequest.findMany({
    where: {
      organizationId,
      reportingPeriodId,
      categoryCode,
      supplierEmail,
      status: 'submitted',
      id: { not: excludeRequestId },
    },
    select: {
      submittedData: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: 'desc' },
    take: 1,
  });

  if (recent.length === 0) return null;

  const lastSubmission = recent[0];
  if (!lastSubmission.submittedData) return null;

  const lastQuantity = (lastSubmission.submittedData as SubmittedData).quantity || 0;
  const diffPercent = Math.abs((quantity - lastQuantity) / Math.max(1, lastQuantity)) * 100;

  if (diffPercent < 5) {
    return {
      type: 'duplicate',
      severity: 'warning',
      message: `Similar submission for this supplier/period/category exists. Last value: ${lastQuantity}.`,
      suggestedValue: lastQuantity,
    };
  }

  return null;
}

function checkForOutliers(quantities: number[], newValue: number): QualityFlag | null {
  if (quantities.length < 3) return null;

  const avg = mean(quantities);
  const stdDev = standardDeviation(quantities);

  if (stdDev === 0) {
    if (newValue !== avg) {
      return {
        type: 'outlier',
        severity: 'info',
        message: `All historical submissions are constant (${avg}). This value differs.`,
        suggestedValue: avg,
      };
    }
    return null;
  }

  const zScore = Math.abs((newValue - avg) / stdDev);

  if (zScore > 3) {
    return {
      type: 'outlier',
      severity: 'critical',
      message: `Extreme outlier detected (${zScore.toFixed(1)}σ from mean). Org average: ${avg.toFixed(2)}.`,
      suggestedRange: {
        min: avg - 2 * stdDev,
        max: avg + 2 * stdDev,
      },
    };
  }

  if (zScore > 2) {
    return {
      type: 'outlier',
      severity: 'warning',
      message: `Outlier detected (${zScore.toFixed(1)}σ from mean). Org average: ${avg.toFixed(2)}.`,
      suggestedRange: {
        min: avg - 2 * stdDev,
        max: avg + 2 * stdDev,
      },
    };
  }

  return null;
}

function checkForZeroValue(quantity: number): QualityFlag | null {
  if (quantity === 0) {
    return {
      type: 'zero_value',
      severity: 'warning',
      message: 'Submission quantity is zero. Confirm this is intentional.',
    };
  }
  return null;
}

function checkForUnitMismatch(
  categoryCode: string,
  unit: string,
  expectedUnits: string[]
): QualityFlag | null {
  if (expectedUnits.length === 0) return null;

  if (!expectedUnits.includes(unit)) {
    return {
      type: 'unit_mismatch',
      severity: 'warning',
      message: `Unexpected unit "${unit}" for category "${categoryCode}". Expected: ${expectedUnits.join(', ')}.`,
    };
  }

  return null;
}

export async function runQualityChecks(
  organizationId: string,
  requestId: string,
  supplierEmail: string,
  reportingPeriodId: string,
  categoryCode: string,
  quantity: number,
  unit: string,
  expectedUnits: string[] = []
): Promise<QualityCheckResult> {
  const flags: QualityFlag[] = [];

  const zeroCheck = checkForZeroValue(quantity);
  if (zeroCheck) flags.push(zeroCheck);

  const unitCheck = checkForUnitMismatch(categoryCode, unit, expectedUnits);
  if (unitCheck) flags.push(unitCheck);

  const dupCheck = await checkForDuplicates(
    organizationId,
    supplierEmail,
    reportingPeriodId,
    categoryCode,
    quantity,
    requestId
  );
  if (dupCheck) flags.push(dupCheck);

  const history = await getOrgHistory(organizationId, categoryCode, requestId);
  const historicalQuantities = history.map((h) => h.quantity);

  if (historicalQuantities.length > 0) {
    const outlierCheck = checkForOutliers(historicalQuantities, quantity);
    if (outlierCheck) flags.push(outlierCheck);
  }

  const hasWarningsOrCritical = flags.some((f) => f.severity !== 'info');
  const approved = !hasWarningsOrCritical;

  return {
    flags,
    approved,
    suggestedQuantity: historicalQuantities.length > 0 ? mean(historicalQuantities) : undefined,
  };
}
