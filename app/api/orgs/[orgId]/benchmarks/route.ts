import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        industry: true,
        hqCountry: true,
      },
    });

    if (!org) {
      return apiError("ORG_NOT_FOUND", "Organization not found", 404);
    }

    // Get current organization's emissions
    const currentOrgEmissions = await prisma.dashboardAggregate.aggregate({
      where: {
        organizationId: orgId,
      },
      _sum: {
        totalCo2e: true,
      },
    });

    const orgEmissions = Number(currentOrgEmissions._sum.totalCo2e ?? 0);

    // Find peer organizations (same industry and country)
    const peers = await prisma.organization.findMany({
      where: {
        id: { not: orgId },
        industry: org.industry,
        hqCountry: org.hqCountry,
      },
      select: {
        id: true,
        name: true,
        industry: true,
        hqCountry: true,
      },
    });

    // Get emissions for all peers
    const peerEmissions: Array<{
      id: string;
      name: string;
      emissions: number;
      reductionRate: number;
    }> = [];

    for (const peer of peers) {
      const emissions = await prisma.dashboardAggregate.aggregate({
        where: { organizationId: peer.id },
        _sum: { totalCo2e: true },
      });

      // Calculate reduction rate (emissions change over 2 years)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const pastEmissions = await prisma.dashboardAggregate.aggregate({
        where: {
          organizationId: peer.id,
          reportingPeriod: {
            startDate: { lte: twoYearsAgo },
          },
        },
        orderBy: { reportingPeriod: { startDate: "desc" } },
        take: 1,
        _sum: { totalCo2e: true },
      });

      const currentEmissions = Number(emissions._sum.totalCo2e ?? 0);
      const oldEmissions = Number(pastEmissions._sum.totalCo2e ?? 0);
      const reductionRate =
        oldEmissions > 0 ? ((oldEmissions - currentEmissions) / oldEmissions) * 100 : 0;

      peerEmissions.push({
        id: peer.id,
        name: peer.name,
        emissions: currentEmissions,
        reductionRate,
      });
    }

    // Calculate organization's reduction rate
    const orgTwoYearsAgo = new Date();
    orgTwoYearsAgo.setFullYear(orgTwoYearsAgo.getFullYear() - 2);

    const orgPastEmissions = await prisma.dashboardAggregate.aggregate({
      where: {
        organizationId: orgId,
        reportingPeriod: {
          startDate: { lte: orgTwoYearsAgo },
        },
      },
      orderBy: { reportingPeriod: { startDate: "desc" } },
      take: 1,
      _sum: { totalCo2e: true },
    });

    const orgOldEmissions = Number(orgPastEmissions._sum.totalCo2e ?? 0);
    const orgReductionRate =
      orgOldEmissions > 0 ? ((orgOldEmissions - orgEmissions) / orgOldEmissions) * 100 : 0;

    // Calculate percentiles
    const allEmissions = [orgEmissions, ...peerEmissions.map((p) => p.emissions)].sort(
      (a, b) => a - b
    );
    const emissionsPercentile =
      (allEmissions.indexOf(orgEmissions) / allEmissions.length) * 100;

    const allReductionRates = [orgReductionRate, ...peerEmissions.map((p) => p.reductionRate)].sort(
      (a, b) => b - a
    );
    const reductionPercentile =
      (allReductionRates.indexOf(orgReductionRate) / allReductionRates.length) * 100;

    // Identify best performers
    const bestByEmissions = peerEmissions.reduce((prev, current) =>
      prev.emissions < current.emissions ? prev : current
    );

    const bestByReduction = peerEmissions.reduce((prev, current) =>
      prev.reductionRate > current.reductionRate ? prev : current
    );

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        industry: org.industry,
        country: org.hqCountry,
        emissions: Math.round(orgEmissions),
        reductionRate: Math.round(orgReductionRate * 10) / 10,
      },
      benchmarks: {
        emissionsPercentile: Math.round(emissionsPercentile),
        reductionPercentile: Math.round(reductionPercentile),
        peerCount: peers.length,
        avgEmissions: Math.round(
          peerEmissions.reduce((sum, p) => sum + p.emissions, 0) / peerEmissions.length
        ),
        avgReductionRate: Math.round(
          (peerEmissions.reduce((sum, p) => sum + p.reductionRate, 0) / peerEmissions.length) * 10
        ) / 10,
      },
      peers: peerEmissions.map((p) => ({
        id: p.id,
        name: p.name,
        emissions: Math.round(p.emissions),
        reductionRate: Math.round(p.reductionRate * 10) / 10,
      })),
      topPerformers: {
        lowestEmissions: bestByEmissions
          ? {
              name: bestByEmissions.name,
              emissions: Math.round(bestByEmissions.emissions),
            }
          : null,
        highestReductionRate: bestByReduction
          ? {
              name: bestByReduction.name,
              reductionRate: Math.round(bestByReduction.reductionRate * 10) / 10,
            }
          : null,
      },
      recommendations:
        emissionsPercentile > 75
          ? [
              "Your emissions are higher than most peers. Consider accelerating reduction initiatives.",
              "Benchmark against industry best practices in sustainable operations.",
            ]
          : reductionPercentile < 25
            ? [
                "Your reduction rate lags behind peers. Review current strategies and increase targets.",
                "Explore successful reduction approaches from high-performing peers.",
              ]
            : ["Your performance is competitive. Continue current trajectory and explore advancement opportunities."],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
