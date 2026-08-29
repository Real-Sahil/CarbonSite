import { prisma } from "@/lib/db";

export interface DataQualityMetrics {
  overallScore: number; // 0-100
  completeness: number; // % of required fields filled
  accuracy: number; // % records with evidence/validation
  timeliness: number; // % records within reporting period
  consistency: number; // % records following standardized categories
  issues: DataQualityIssue[];
  summary: {
    totalRecords: number;
    missingEvidence: number;
    outOfPeriod: number;
    uncategorized: number;
    pendingReview: number;
  };
}

export interface DataQualityIssue {
  code: string;
  severity: "critical" | "warning" | "info";
  message: string;
  affectedRecordCount: number;
  recommendation: string;
}

/**
 * Calculate comprehensive data quality score for organization and period.
 */
export async function calculateDataQualityScore(
  organizationId: string,
  reportingPeriodId?: string
): Promise<DataQualityMetrics> {
  let whereClause: any = { organizationId };

  if (reportingPeriodId) {
    whereClause.reportingPeriodId = reportingPeriodId;
  }

  // Get all activity records for the org/period
  const records = await prisma.activityRecord.findMany({
    where: whereClause,
    include: {
      emissionCategory: true,
      facility: true,
      businessUnit: true,
      evidence: {
        select: { id: true },
      },
      calculations: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (records.length === 0) {
    return {
      overallScore: 0,
      completeness: 0,
      accuracy: 0,
      timeliness: 0,
      consistency: 0,
      issues: [
        {
          code: "NO_DATA",
          severity: "warning",
          message: "No activity records found for this period",
          affectedRecordCount: 0,
          recommendation: "Import or manually create activity records to begin tracking emissions.",
        },
      ],
      summary: {
        totalRecords: 0,
        missingEvidence: 0,
        outOfPeriod: 0,
        uncategorized: 0,
        pendingReview: 0,
      },
    };
  }

  const issues: DataQualityIssue[] = [];

  // 1. Completeness: required fields present
  let completeCount = 0;
  let missingDescriptionCount = 0;
  let missingUnitCount = 0;

  for (const record of records) {
    const isComplete =
      (record.sourceDescription?.trim() ?? "").length > 0 &&
      record.amount !== null &&
      record.unit !== null &&
      record.emissionCategoryId !== null;

    if (isComplete) completeCount++;
    if (!record.sourceDescription || record.sourceDescription.trim().length === 0) missingDescriptionCount++;
    if (!record.unit) missingUnitCount++;
  }

  const completeness = Math.round((completeCount / records.length) * 100);

  if (missingDescriptionCount > 0) {
    issues.push({
      code: "MISSING_DESCRIPTION",
      severity: missingDescriptionCount > records.length * 0.1 ? "warning" : "info",
      message: `${missingDescriptionCount} records missing description`,
      affectedRecordCount: missingDescriptionCount,
      recommendation: "Add descriptive labels to all activity records for better tracking.",
    });
  }

  // 2. Accuracy: evidence provided
  const withEvidence = records.filter((r) => r.evidence && r.evidence.length > 0).length;
  const accuracy = Math.round((withEvidence / records.length) * 100);

  const missingEvidence = records.length - withEvidence;
  if (missingEvidence > 0) {
    issues.push({
      code: "MISSING_EVIDENCE",
      severity: missingEvidence > records.length * 0.2 ? "critical" : "warning",
      message: `${missingEvidence} records without supporting evidence`,
      affectedRecordCount: missingEvidence,
      recommendation: "Upload receipts, invoices, or other supporting documents to strengthen data credibility.",
    });
  }

  // 3. Timeliness: records within period
  let inPeriodCount = records.length;
  let outOfPeriodCount = 0;

  if (reportingPeriodId) {
    const period = await prisma.reportingPeriod.findUnique({
      where: { id: reportingPeriodId },
    });

    if (period) {
      for (const record of records) {
        const recordDate = record.createdAt;
        if (
          recordDate < period.startDate ||
          recordDate > period.endDate
        ) {
          outOfPeriodCount++;
          inPeriodCount--;
        }
      }
    }
  }

  const timeliness = Math.round((inPeriodCount / records.length) * 100);

  if (outOfPeriodCount > 0) {
    issues.push({
      code: "OUT_OF_PERIOD",
      severity: outOfPeriodCount > records.length * 0.05 ? "warning" : "info",
      message: `${outOfPeriodCount} records created outside reporting period`,
      affectedRecordCount: outOfPeriodCount,
      recommendation: "Verify record dates align with the reporting period boundaries.",
    });
  }

  // 4. Consistency: standardized categories
  let withStandardCategory = 0;
  for (const record of records) {
    if (record.emissionCategory) {
      withStandardCategory++;
    }
  }

  const consistency = Math.round((withStandardCategory / records.length) * 100);
  const uncategorized = records.length - withStandardCategory;

  if (uncategorized > 0) {
    issues.push({
      code: "UNCATEGORIZED",
      severity: uncategorized > records.length * 0.05 ? "warning" : "info",
      message: `${uncategorized} records without standard emission category`,
      affectedRecordCount: uncategorized,
      recommendation: "Assign all records to one of the standard emission categories (Scope 1, 2, or 3).",
    });
  }

  // 5. Review status
  const pendingReview = records.filter(
    (r) => r.reviewStatus === "in_review"
  ).length;
  if (pendingReview > 0) {
    issues.push({
      code: "PENDING_REVIEW",
      severity: pendingReview > records.length * 0.25 ? "warning" : "info",
      message: `${pendingReview} records pending review`,
      affectedRecordCount: pendingReview,
      recommendation: "Complete the review process to finalize emissions calculations.",
    });
  }

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    completeness * 0.2 +
      accuracy * 0.35 +
      timeliness * 0.2 +
      consistency * 0.15 +
      (100 - Math.min(pendingReview / records.length * 100, 100)) * 0.1
  );

  // Sort issues by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    overallScore,
    completeness,
    accuracy,
    timeliness,
    consistency,
    issues: issues.slice(0, 10), // Limit to top 10 issues
    summary: {
      totalRecords: records.length,
      missingEvidence,
      outOfPeriod: outOfPeriodCount,
      uncategorized,
      pendingReview,
    },
  };
}

/**
 * Get data quality trend over time (by month).
 */
export async function getDataQualityTrend(
  organizationId: string,
  monthsBack: number = 6
): Promise<
  Array<{
    month: string;
    score: number;
    recordCount: number;
  }>
> {
  const trend: Array<{ month: string; score: number; recordCount: number }> = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const records = await prisma.activityRecord.findMany({
      where: {
        organizationId,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      select: {
        id: true,
        sourceDescription: true,
        unit: true,
        amount: true,
        emissionCategoryId: true,
        evidence: { select: { id: true } },
        reviewStatus: true,
      },
    });

    if (records.length > 0) {
      // Quick score calculation for trend
      const withEvidence = records.filter((r) => r.evidence && r.evidence.length > 0).length;
      const withCategory = records.filter((r) => r.emissionCategoryId).length;
      const reviewed = records.filter((r) => r.reviewStatus === "approved").length;

      const score = Math.round(
        (withEvidence / records.length) * 0.4 +
          (withCategory / records.length) * 0.3 +
          (reviewed / records.length) * 0.3
      ) * 100;

      trend.push({
        month: monthStart.toLocaleDateString("en-US", { year: "2-digit", month: "short" }),
        score,
        recordCount: records.length,
      });
    } else {
      trend.push({
        month: monthStart.toLocaleDateString("en-US", { year: "2-digit", month: "short" }),
        score: 0,
        recordCount: 0,
      });
    }
  }

  return trend;
}

/**
 * Identify and flag high-risk records that need attention.
 */
export async function identifyHighRiskRecords(
  organizationId: string,
  limit: number = 20
): Promise<
  Array<{
    id: string;
    description: string;
    riskScore: number; // 0-100
    risks: string[];
  }>
> {
  const records = await prisma.activityRecord.findMany({
    where: { organizationId },
    include: {
      evidence: { select: { id: true } },
      emissionCategory: true,
      calculations: { select: { id: true }, take: 1 },
    },
    take: limit * 2,
  });

  const recordsWithRisk = records.map((record) => {
    const risks: string[] = [];
    let riskScore = 0;

    // No evidence
    if (!record.evidence || record.evidence.length === 0) {
      risks.push("No supporting evidence");
      riskScore += 25;
    }

    // Pending review
    if (record.reviewStatus === "in_review") {
      risks.push("Pending review");
      riskScore += 15;
    }

    // Not calculated
    if (!record.calculations || record.calculations.length === 0) {
      risks.push("Not yet calculated");
      riskScore += 20;
    }

    // No unit
    if (!record.unit) {
      risks.push("Missing unit");
      riskScore += 15;
    }

    // No category
    if (!record.emissionCategory) {
      risks.push("Uncategorized");
      riskScore += 20;
    }

    // Large quantity (potential outlier)
    if (record.amount && Number(record.amount) > 10000) {
      risks.push("Unusually large quantity");
      riskScore += 10;
    }

    return {
      id: record.id,
      description: record.sourceDescription || "(No description)",
      riskScore: Math.min(riskScore, 100),
      risks,
    };
  });

  return recordsWithRisk
    .filter((r) => r.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit);
}
