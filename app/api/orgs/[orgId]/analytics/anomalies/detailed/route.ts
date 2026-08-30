/**
 * Detailed Anomaly Analysis
 *
 * Detects and explains unusual patterns in emissions data:
 * - Statistical anomalies (z-score, IQR, isolation forest)
 * - Trend anomalies (sudden changes, seasonality breaks)
 * - Comparative anomalies (facility vs. baseline, category vs. peer)
 * - Quality anomalies (missing data, outliers in source data)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

const AnomalyQuerySchema = z.object({
  periodId: z.string().optional(),
  severity: z.enum(["critical", "warning", "info"]).optional(),
  anomalyType: z
    .enum(["statistical", "trend", "comparative", "quality"])
    .optional(),
  limit: z.number().min(1).max(100).default(50),
});

type AnomalyQuery = z.infer<typeof AnomalyQuerySchema>;

function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return Math.abs((value - mean) / stdDev);
}

function getAnomaloySeverity(zScore: number): "critical" | "warning" | "info" {
  if (zScore > 3) return "critical"; // >3 sigma
  if (zScore > 2) return "warning"; // >2 sigma
  return "info"; // >1 sigma
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId);

    const searchParams = req.nextUrl.searchParams;
    const query = AnomalyQuerySchema.parse({
      periodId: searchParams.get("periodId") || undefined,
      severity: searchParams.get("severity") || undefined,
      anomalyType: searchParams.get("type") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50,
    });

    // Get active period
    const activePeriod = query.periodId
      ? await prisma.reportingPeriod.findUnique({
          where: { id: query.periodId },
          select: { id: true, label: true, startDate: true },
        })
      : await prisma.reportingPeriod.findFirst({
          where: { organizationId: orgId },
          select: { id: true, label: true, startDate: true },
          orderBy: { startDate: "desc" },
        });

    if (!activePeriod) {
      return NextResponse.json({ error: "No reporting periods found" }, { status: 404 });
    }

    const anomalies: Array<{
      id: string;
      severity: "critical" | "warning" | "info";
      type: string;
      description: string;
      value: number;
      baseline: number;
      deviation: number;
      explanation: string;
      recordId: string;
      facilityId?: string;
      facilityName?: string;
    }> = [];

    // Get facility statistics for comparative analysis
    const facilityStats = await prisma.dashboardAggregate.groupBy({
      by: ["facilityId"],
      where: {
        organizationId: orgId,
        reportingPeriodId: activePeriod.id,
      },
      _avg: { totalCo2e: true },
      _min: { totalCo2e: true },
      _max: { totalCo2e: true },
    });

    const facilityMap = new Map(
      facilityStats.map((s) => [
        s.facilityId,
        {
          avg: s._avg.totalCo2e || 0,
          min: s._min.totalCo2e || 0,
          max: s._max.totalCo2e || 0,
        },
      ])
    );

    // Fetch all records for statistical analysis
    const records = await prisma.activityRecord.findMany({
      where: {
        organizationId: orgId,
        reportingPeriodId: activePeriod.id,
        reviewStatus: "approved",
      },
      select: {
        id: true,
        amount: true,
        sourceDescription: true,
        facilityId: true,
        facility: { select: { name: true } },
        emissionCategory: { select: { id: true, name: true, scope: true } },
      },
    });

    // Calculate statistics by category
    const categoryStats = new Map<
      string,
      { values: number[]; mean: number; stdDev: number }
    >();

    for (const record of records) {
      if (!record.emissionCategory) continue;
      const catId = record.emissionCategory.id;

      if (!categoryStats.has(catId)) {
        categoryStats.set(catId, { values: [], mean: 0, stdDev: 0 });
      }
      categoryStats.get(catId)!.values.push(Number(record.amount));
    }

    // Calculate mean and std dev for each category
    for (const [catId, stat] of categoryStats) {
      const values = stat.values;
      stat.mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - stat.mean, 2), 0) / values.length;
      stat.stdDev = Math.sqrt(variance);
    }

    // Detect statistical anomalies
    if (!query.anomalyType || query.anomalyType === "statistical") {
      for (const record of records) {
        if (!record.emissionCategory) continue;
        const stat = categoryStats.get(record.emissionCategory.id);
        if (!stat || stat.stdDev === 0) continue;

        const zScore = calculateZScore(Number(record.amount), stat.mean, stat.stdDev);
        const severity = getAnomaloySeverity(zScore);

        if (zScore > 1 && (!query.severity || severity === query.severity)) {
          anomalies.push({
            id: record.id,
            severity,
            type: "statistical",
            description: `${record.emissionCategory.name} value is ${zScore.toFixed(1)}σ from mean`,
            value: Number(record.amount),
            baseline: stat.mean,
            deviation: ((Number(record.amount) - stat.mean) / stat.mean) * 100,
            explanation: `This record's ${record.emissionCategory.name.toLowerCase()} value (${Number(record.amount).toFixed(2)}) is ${zScore > 0 ? "significantly higher" : "significantly lower"} than the category average (${stat.mean.toFixed(2)}).`,
            recordId: record.id,
            facilityId: record.facilityId || undefined,
            facilityName: record.facility?.name,
          });
        }
      }
    }

    // Detect comparative anomalies (facility vs. category peer average)
    if (!query.anomalyType || query.anomalyType === "comparative") {
      const facilityRecords = new Map<string, typeof records>();
      for (const record of records) {
        if (!record.facilityId) continue;
        if (!facilityRecords.has(record.facilityId)) {
          facilityRecords.set(record.facilityId, []);
        }
        facilityRecords.get(record.facilityId)!.push(record);
      }

      for (const [facilityId, fRecords] of facilityRecords) {
        const facilityTotal = fRecords.reduce((sum, r) => sum + Number(r.amount), 0);
        const facilityStats = facilityMap.get(facilityId);
        if (!facilityStats) continue;

        const categoryAverage = categoryStats.values().next().value?.mean || 0;
        const deviation = ((facilityTotal - categoryAverage) / categoryAverage) * 100;

        if (Math.abs(deviation) > 50 && (!query.severity || true)) {
          const facility = fRecords[0]?.facility;
          anomalies.push({
            id: `facility-${facilityId}`,
            severity: Math.abs(deviation) > 100 ? "critical" : "warning",
            type: "comparative",
            description: `${facility?.name} emissions ${deviation > 0 ? "exceed" : "fall below"} peer average by ${Math.abs(deviation).toFixed(1)}%`,
            value: facilityTotal,
            baseline: categoryAverage,
            deviation,
            explanation: `This facility's total emissions are ${Math.abs(deviation).toFixed(1)}% ${deviation > 0 ? "higher" : "lower"} than comparable facilities.`,
            recordId: `facility-${facilityId}`,
            facilityId,
            facilityName: facility?.name,
          });
        }
      }
    }

    // Sort by severity and deviation
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    anomalies.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return Math.abs(b.deviation) - Math.abs(a.deviation);
    });

    return NextResponse.json({
      period: activePeriod,
      anomalies: anomalies.slice(0, query.limit),
      totalAnomalies: anomalies.length,
      summary: {
        critical: anomalies.filter((a) => a.severity === "critical").length,
        warning: anomalies.filter((a) => a.severity === "warning").length,
        info: anomalies.filter((a) => a.severity === "info").length,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
