import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

const querySchema = z.object({
  industry: z.string().optional(),
  country: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const query = querySchema.parse({
      industry: request.nextUrl.searchParams.get("industry") ?? undefined,
      country: request.nextUrl.searchParams.get("country") ?? undefined,
    });

    // Get all organizations with the specified filters
    const orgs = await prisma.organization.findMany({
      where: {
        ...(query.industry && { industry: query.industry }),
        ...(query.country && { hqCountry: query.country }),
      },
      select: { id: true },
    });

    if (orgs.length === 0) {
      return NextResponse.json({
        criteria: { industry: query.industry, country: query.country },
        stats: {
          organizationCount: 0,
          message: "No organizations found matching criteria",
        },
        data: [],
      });
    }

    // Get total emissions by organization
    const emissionsByOrg = await prisma.dashboardAggregate.groupBy({
      by: ["organizationId"],
      where: {
        organizationId: { in: orgs.map((o) => o.id) },
      },
      _sum: {
        totalCo2e: true,
      },
    });

    const emissionValues = emissionsByOrg
      .map((e) => Number(e._sum.totalCo2e ?? 0))
      .sort((a, b) => a - b);

    // Calculate statistics
    const sum = emissionValues.reduce((a, b) => a + b, 0);
    const mean = sum / emissionValues.length;
    const median =
      emissionValues.length % 2 === 0
        ? (emissionValues[emissionValues.length / 2 - 1] +
            emissionValues[emissionValues.length / 2]) /
          2
        : emissionValues[Math.floor(emissionValues.length / 2)];

    const variance =
      emissionValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      emissionValues.length;
    const stdDev = Math.sqrt(variance);

    const quartiles = {
      q1: emissionValues[Math.floor(emissionValues.length * 0.25)],
      q2: median,
      q3: emissionValues[Math.floor(emissionValues.length * 0.75)],
    };

    // Get top and bottom performers
    const topEmitters = emissionsByOrg
      .sort((a, b) => (Number(b._sum.totalCo2e ?? 0) - Number(a._sum.totalCo2e ?? 0)))
      .slice(0, 5)
      .map((e) => ({
        organizationId: e.organizationId,
        emissions: Math.round(Number(e._sum.totalCo2e ?? 0)),
      }));

    const topReducers = await Promise.all(
      emissionsByOrg.slice(0, 10).map(async (e) => {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const past = await prisma.dashboardAggregate.aggregate({
          where: {
            organizationId: e.organizationId,
            reportingPeriod: { startDate: { lte: twoYearsAgo } },
          },
          orderBy: { reportingPeriod: { startDate: "desc" } },
          take: 1,
          _sum: { totalCo2e: true },
        });

        const current = Number(e._sum.totalCo2e ?? 0);
        const oldEmissions = Number(past._sum.totalCo2e ?? 0);
        const reductionRate = oldEmissions > 0 ? ((oldEmissions - current) / oldEmissions) * 100 : 0;

        return {
          organizationId: e.organizationId,
          reductionRate: Math.round(reductionRate * 10) / 10,
        };
      })
    );

    return NextResponse.json({
      criteria: {
        industry: query.industry,
        country: query.country,
      },
      stats: {
        organizationCount: emissionValues.length,
        totalEmissions: Math.round(sum),
        avgEmissions: Math.round(mean),
        medianEmissions: Math.round(median),
        stdDeviation: Math.round(stdDev),
        minEmissions: Math.round(emissionValues[0]),
        maxEmissions: Math.round(emissionValues[emissionValues.length - 1]),
      },
      distribution: {
        q1: Math.round(quartiles.q1),
        q2: Math.round(quartiles.q2),
        q3: Math.round(quartiles.q3),
      },
      topEmitters,
      topReducers: topReducers
        .sort((a, b) => b.reductionRate - a.reductionRate)
        .slice(0, 5),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
