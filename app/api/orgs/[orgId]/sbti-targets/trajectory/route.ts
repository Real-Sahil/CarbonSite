import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";

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
        netZeroReductionPct: true,
      },
    });

    if (!target) {
      return apiError("TARGET_NOT_FOUND", "SBTi target not configured", 404);
    }

    // Calculate total baseline emissions
    const baselineScope1 = Number(target.baselineScope1Tco2e);
    const baselineScope2 = Number(target.baselineScope2Tco2e);
    const baselineScope3 = target.baselineScope3Tco2e
      ? Number(target.baselineScope3Tco2e)
      : 0;
    const totalBaseline = baselineScope1 + baselineScope2 + baselineScope3;

    // Build near-term trajectory
    const yearsToNearTerm = target.nearTermYear - target.baseYear;
    const nearTermReduction = Number(target.nearTermReductionPct);
    const nearTermEmissions = totalBaseline * (1 - nearTermReduction / 100);
    const annualNearTermRate = (totalBaseline - nearTermEmissions) / yearsToNearTerm;

    // Build net-zero trajectory
    const yearsToNetZero = target.netZeroYear - target.baseYear;
    const netZeroReduction = Number(target.netZeroReductionPct);
    const netZeroEmissions = totalBaseline * (1 - netZeroReduction / 100);
    const annualNetZeroRate = (totalBaseline - netZeroEmissions) / yearsToNetZero;

    // Build trajectory for each year
    const trajectory = [];
    const currentYear = new Date().getFullYear();

    for (
      let year = target.baseYear;
      year <= Math.max(target.nearTermYear, target.netZeroYear);
      year++
    ) {
      // Calculate expected emissions for this year
      let expectedEmissions = totalBaseline;
      let targetMilestone = "baseline";

      if (year > target.baseYear && year <= target.nearTermYear) {
        expectedEmissions = totalBaseline - annualNearTermRate * (year - target.baseYear);
        targetMilestone = "near-term";
      } else if (year > target.nearTermYear && year <= target.netZeroYear) {
        expectedEmissions = totalBaseline - annualNetZeroRate * (year - target.baseYear);
        targetMilestone = "net-zero";
      }

      // Get actual emissions for this year
      const yearStart = new Date(`${year}-01-01`);
      const yearEnd = new Date(`${year}-12-31`);

      const actualEmissions = await prisma.dashboardAggregate.aggregate({
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

      const actual = Number(actualEmissions._sum?.totalCo2e ?? 0);
      const deviation = actual - expectedEmissions;
      const status = deviation <= 0 ? "on_track" : "behind";

      trajectory.push({
        year,
        expected: Math.round(expectedEmissions),
        actual: Math.round(actual),
        deviation: Math.round(deviation),
        deviationPercent:
          expectedEmissions > 0 ? Math.round((deviation / expectedEmissions) * 1000) / 10 : 0,
        targetMilestone,
        status,
      });
    }

    // Calculate overall progress
    const currentData = trajectory.find((t) => t.year === currentYear);
    const progressPercent = currentData
      ? Math.max(0, Math.min(100, 100 - currentData.deviationPercent * 2))
      : 0;

    return NextResponse.json({
      target: {
        id: target.id,
        pathway: target.pathway,
        baseYear: target.baseYear,
        baselineEmissions: Math.round(totalBaseline),
        baselineByScope: {
          scope1: Math.round(baselineScope1),
          scope2: Math.round(baselineScope2),
          scope3: Math.round(baselineScope3),
        },
        nearTermYear: target.nearTermYear,
        nearTermEmissions: Math.round(nearTermEmissions),
        nearTermReduction: nearTermReduction,
        netZeroYear: target.netZeroYear,
        netZeroEmissions: Math.round(netZeroEmissions),
        netZeroReduction: netZeroReduction,
      },
      trajectory,
      progress: {
        percent: progressPercent,
        status: currentData?.status ?? "unknown",
        lastUpdateYear: currentYear,
        currentDeviation: currentData?.deviation ?? 0,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
