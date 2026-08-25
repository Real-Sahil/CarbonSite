import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

interface TrajectoryAlert {
  severity: "critical" | "warning" | "info";
  message: string;
  currentDeviation: number;
  deviationPercent: number;
  recommendedAction: string;
  targetMilestone: "near-term" | "net-zero";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const target = await prisma.sbtiTarget.findUnique({
      where: { organizationId: orgId },
      select: {
        id: true,
        pathway: true,
        baseYear: true,
        baselineScope1Tco2e: true,
        baselineScope2Tco2e: true,
        baselineScope3Tco2e: true,
        nearTermYear: true,
        nearTermReductionPct: true,
        netZeroYear: true,
      },
    });

    if (!target) {
      return NextResponse.json({
        alerts: [],
        summary: { total: 0, critical: 0, warning: 0 },
      });
    }

    const alerts: TrajectoryAlert[] = [];
    const currentYear = new Date().getFullYear();

    // Calculate baseline emissions
    const baselineScope1 = Number(target.baselineScope1Tco2e);
    const baselineScope2 = Number(target.baselineScope2Tco2e);
    const baselineScope3 = target.baselineScope3Tco2e
      ? Number(target.baselineScope3Tco2e)
      : 0;
    const totalBaseline = baselineScope1 + baselineScope2 + baselineScope3;

    // Get actual current year emissions
    const yearStart = new Date(`${currentYear}-01-01`);
    const yearEnd = new Date(`${currentYear}-12-31`);

    const actualData = await prisma.dashboardAggregate.aggregate({
      where: {
        organizationId: orgId,
        reportingPeriod: {
          startDate: { gte: yearStart },
          endDate: { lte: yearEnd },
        },
      },
      _sum: {
        totalCo2e: true,
      },
    });

    const actual = Number(actualData._sum?.totalCo2e ?? 0);

    // Check near-term target
    if (currentYear <= target.nearTermYear) {
      const yearsToNearTerm = target.nearTermYear - target.baseYear;
      const nearTermReduction = Number(target.nearTermReductionPct);
      const expectedNearTerm = totalBaseline * (1 - nearTermReduction / 100);
      const annualRate = (totalBaseline - expectedNearTerm) / yearsToNearTerm;
      const yearsElapsed = currentYear - target.baseYear;
      const expectedEmissions = totalBaseline - annualRate * yearsElapsed;
      const deviation = actual - expectedEmissions;
      const deviationPercent = (deviation / expectedEmissions) * 100;

      if (deviation > 0) {
        let severity: "critical" | "warning" | "info" = "info";
        let message = "";
        let recommendedAction = "";

        if (deviationPercent > 20) {
          severity = "critical";
          message = `Near-term target (${target.nearTermYear}): Current emissions are ${Math.round(deviationPercent)}% above trajectory. Immediate action required.`;
          recommendedAction =
            "Accelerate emission reduction initiatives and review baseline assumptions.";
        } else if (deviationPercent > 10) {
          severity = "warning";
          message = `Near-term target (${target.nearTermYear}): Current emissions are ${Math.round(deviationPercent)}% above trajectory.`;
          recommendedAction =
            "Monitor closely and intensify reduction efforts to get back on track.";
        } else {
          severity = "info";
          message = `Near-term target (${target.nearTermYear}): Minor deviation (${Math.round(deviationPercent)}%).`;
          recommendedAction = "Continue monitoring progress.";
        }

        alerts.push({
          severity,
          message,
          currentDeviation: Math.round(deviation),
          deviationPercent: Math.round(deviationPercent * 10) / 10,
          recommendedAction,
          targetMilestone: "near-term",
        });
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );

    return NextResponse.json({
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter((a) => a.severity === "critical").length,
        warning: alerts.filter((a) => a.severity === "warning").length,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
