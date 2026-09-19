import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { z } from "zod";
import { PRIMARY_SCOPE2_METHOD } from "@/lib/calculation/aggregate-filters";

// Cross-organization statistics. Below this cohort size the mean, median, min
// and max all approximate a single tenant's exact emissions, so nothing is
// returned. Narrowing industry and country is otherwise enough to isolate one
// organization and read its inventory straight out of the statistics.
const MIN_COHORT = 5;
const MAX_ORGS = 500;

const querySchema = z.object({
  industry: z.string().optional(),
  country: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    // This endpoint previously had no authentication at all, which made every
    // customer's emissions readable by anyone who could reach the URL.
    await requireSession();

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
      take: MAX_ORGS,
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

    // Each organization is measured on its own latest reporting period. Summing
    // DashboardAggregate by organizationId alone adds every period, every
    // published snapshot copy and every breakdown dimension together.
    const latestPeriods = await prisma.reportingPeriod.findMany({
      where: { organizationId: { in: orgs.map((o) => o.id) } },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, organizationId: true },
    });
    const periodByOrg = new Map<string, string>();
    for (const period of latestPeriods) {
      if (!periodByOrg.has(period.organizationId)) {
        periodByOrg.set(period.organizationId, period.id);
      }
    }
    const orgScope = Array.from(periodByOrg.entries()).map(
      ([organizationId, reportingPeriodId]) => ({ organizationId, reportingPeriodId }),
    );

    const emissionsByOrg = orgScope.length
      ? await prisma.dashboardAggregate.groupBy({
          by: ["organizationId"],
          where: {
            // Both fragments are OR-shaped, so nest them under AND.
            AND: [{ OR: orgScope }, PRIMARY_SCOPE2_METHOD],
            snapshotId: null,
            emissionCategoryId: null,
            businessUnitId: null,
            facilityId: null,
          },
          _sum: { totalCo2e: true },
        })
      : [];

    const emissionValues = emissionsByOrg
      .map((e) => Number(e._sum.totalCo2e ?? 0))
      .sort((a, b) => a - b);

    if (emissionValues.length < MIN_COHORT) {
      return NextResponse.json({
        criteria: { industry: query.industry, country: query.country },
        stats: {
          organizationCount: emissionValues.length,
          message: `Industry statistics need at least ${MIN_COHORT} organisations with a calculated inventory. ${emissionValues.length} found.`,
        },
        distribution: null,
      });
    }

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
      // topEmitters and topReducers used to be returned here, each carrying a
      // raw organizationId alongside that organization's exact emissions. That
      // identified other tenants, so the distribution statistics above are now
      // the whole answer.
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
