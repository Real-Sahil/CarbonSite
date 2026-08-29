import { prisma } from "@/lib/db";
import type { DataQualityCheck } from "@prisma/client";

export interface QualityScore {
  overallScore: number; // 0-100
  dimensions: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    validity: number;
  };
  status: 'excellent' | 'good' | 'fair' | 'poor';
  warnings: string[];
  recommendations: string[];
}

export interface DataQualityMetrics {
  totalRecords: number;
  validRecords: number;
  failedRecords: number;
  validationPassRate: number;
  commonIssues: Array<{ issue: string; count: number; percentage: number }>;
}

export async function scoreImportQuality(
  batchId: string,
  checks: DataQualityCheck[]
): Promise<QualityScore> {
  // Calculate dimension scores based on check types
  const dimensions = {
    completeness: calculateDimensionScore(checks, 'completeness'),
    accuracy: calculateDimensionScore(checks, 'accuracy'),
    consistency: calculateDimensionScore(checks, 'consistency'),
    timeliness: calculateDimensionScore(checks, 'timeliness'),
    validity: calculateDimensionScore(checks, 'validity'),
  };

  // Overall score is weighted average of dimensions
  const overallScore = Math.round(
    (dimensions.completeness * 0.25 +
      dimensions.accuracy * 0.25 +
      dimensions.consistency * 0.2 +
      dimensions.timeliness * 0.15 +
      dimensions.validity * 0.15)
  );

  // Determine status
  let status: 'excellent' | 'good' | 'fair' | 'poor';
  if (overallScore >= 85) status = 'excellent';
  else if (overallScore >= 70) status = 'good';
  else if (overallScore >= 50) status = 'fair';
  else status = 'poor';

  // Generate warnings and recommendations
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (dimensions.completeness < 80) {
    warnings.push('High number of missing values detected');
    recommendations.push('Review source data for completeness before importing');
  }

  if (dimensions.accuracy < 80) {
    warnings.push('Data accuracy concerns identified');
    recommendations.push('Manual review recommended for flagged records');
  }

  if (dimensions.validity < 80) {
    warnings.push('Invalid values detected in records');
    recommendations.push('Fix data type errors and value ranges');
  }

  if (dimensions.timeliness < 80) {
    warnings.push('Some records are outdated');
    recommendations.push('Ensure data is from the current reporting period');
  }

  return {
    overallScore,
    dimensions,
    status,
    warnings,
    recommendations,
  };
}

function calculateDimensionScore(
  checks: DataQualityCheck[],
  dimension: string
): number {
  const dimensionChecks = checks.filter(c =>
    c.checkType?.toLowerCase().includes(dimension.toLowerCase())
  );

  if (dimensionChecks.length === 0) return 100;

  const passed = dimensionChecks.filter(c => c.passed).length;
  return Math.round((passed / dimensionChecks.length) * 100);
}

export async function calculateMetrics(
  orgId: string,
  batchId?: string
): Promise<DataQualityMetrics> {
  // Query recent import batches and their quality checks
  const batches = await prisma.importBatch.findMany({
    where: {
      organizationId: orgId,
      ...(batchId && { id: batchId }),
    },
    include: {
      qualityChecks: true,
    },
    orderBy: { createdAt: 'desc' },
    take: batchId ? undefined : 10, // Last 10 batches if not specified
  });

  const allChecks = batches.flatMap(b => b.qualityChecks);
  const passedChecks = allChecks.filter(c => c.passed);

  // Extract common issues from failed checks
  const issueMap = new Map<string, number>();
  allChecks
    .filter(c => !c.passed)
    .forEach(c => {
      const key = `${c.checkType}: ${c.checkName}`;
      issueMap.set(key, (issueMap.get(key) ?? 0) + 1);
    });

  const commonIssues = Array.from(issueMap.entries())
    .map(([issue, count]) => ({
      issue,
      count,
      percentage: (count / allChecks.length) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalRecords: batches.reduce((sum, b) => sum + (b.rowCount ?? 0), 0),
    validRecords: batches.reduce((sum, b) => sum + ((b.rowCount ?? 0) - b.errorCount), 0),
    failedRecords: batches.reduce((sum, b) => sum + b.errorCount, 0),
    validationPassRate: allChecks.length > 0 ? (passedChecks.length / allChecks.length) * 100 : 0,
    commonIssues,
  };
}
