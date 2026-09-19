import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { latestPeriodLiveCo2e } from "@/lib/calculation/aggregate-filters";

// Peer figures are only ever returned in aggregate. Naming another tenant, or
// returning a figure a single tenant can be identified from, would disclose one
// customer's emissions to another.
const MIN_PEER_COHORT = 3;
// Caps the per-peer queries below; a cohort larger than this is still
// statistically ample for percentile comparison.
const MAX_PEERS = 50;

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

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const orgEmissions = (await latestPeriodLiveCo2e(orgId)) ?? 0;
    const orgOldEmissions = await latestPeriodLiveCo2e(orgId, twoYearsAgo);
    const orgReductionRate =
      orgOldEmissions != null && orgOldEmissions > 0
        ? ((orgOldEmissions - orgEmissions) / orgOldEmissions) * 100
        : 0;

    // Find peer organizations (same industry and country). Ids are used to query
    // their totals and are never returned.
    const peers = await prisma.organization.findMany({
      where: {
        id: { not: orgId },
        industry: org.industry,
        hqCountry: org.hqCountry,
      },
      select: { id: true },
      take: MAX_PEERS,
    });

    const peerEmissions: Array<{ emissions: number; reductionRate: number }> = [];

    for (const peer of peers) {
      const currentEmissions = await latestPeriodLiveCo2e(peer.id);
      // A peer with no calculated inventory is not a data point. Treating it as
      // zero would drag every average and percentile toward zero.
      if (currentEmissions == null) continue;

      const oldEmissions = await latestPeriodLiveCo2e(peer.id, twoYearsAgo);
      const reductionRate =
        oldEmissions != null && oldEmissions > 0
          ? ((oldEmissions - currentEmissions) / oldEmissions) * 100
          : 0;

      peerEmissions.push({ emissions: currentEmissions, reductionRate });
    }

    // Below the cohort floor an individual peer's emissions can be backed out of
    // the average, so no comparison is returned at all.
    if (peerEmissions.length < MIN_PEER_COHORT) {
      return NextResponse.json({
        organization: {
          id: org.id,
          name: org.name,
          industry: org.industry,
          country: org.hqCountry,
          emissions: Math.round(orgEmissions),
          reductionRate: Math.round(orgReductionRate * 10) / 10,
        },
        benchmarks: null,
        peerCount: peerEmissions.length,
        message: `Benchmarking needs at least ${MIN_PEER_COHORT} comparable organisations with a calculated inventory. ${peerEmissions.length} found.`,
      });
    }

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

    // Best and worst of the cohort as bare figures. The previous version
    // returned the peer's name, which disclosed one tenant's emissions to
    // another, and used reduce() with no initial value, so it threw
    // "Reduce of empty array with no initial value" for any org without peers.
    const lowestPeerEmissions = Math.min(...peerEmissions.map((p) => p.emissions));
    const highestPeerReductionRate = Math.max(
      ...peerEmissions.map((p) => p.reductionRate),
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
        peerCount: peerEmissions.length,
        avgEmissions: Math.round(
          peerEmissions.reduce((sum, p) => sum + p.emissions, 0) / peerEmissions.length
        ),
        avgReductionRate: Math.round(
          (peerEmissions.reduce((sum, p) => sum + p.reductionRate, 0) / peerEmissions.length) * 10
        ) / 10,
        // Cohort extremes only. Which organisation they belong to is not
        // disclosed.
        lowestPeerEmissions: Math.round(lowestPeerEmissions),
        highestPeerReductionRate: Math.round(highestPeerReductionRate * 10) / 10,
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
