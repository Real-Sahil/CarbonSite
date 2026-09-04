export const dynamic = "force-dynamic";

// Surfaces the scientific-rigour layer for a calculation run: the Monte
// Carlo-propagated inventory uncertainty (vs. what naive linear summation
// of each record's own interval would have claimed), the biogenic CO2 memo
// total (kept separate from totalCo2e per GHG Protocol convention), and the
// records whose pedigree-derived data quality is weakest, so a reviewer
// knows exactly where to focus.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; runId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, runId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const run = await prisma.calculationRun.findUnique({
      where: { id: runId },
      select: { id: true, organizationId: true, status: true },
    });

    if (!run || run.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Calculation run not found.", 404);
    }

    const [uncertainty, biogenicAgg, worstRecords] = await Promise.all([
      prisma.calculationUncertaintyResult.findUnique({ where: { calculationRunId: runId } }),
      prisma.emissionCalculation.aggregate({
        where: { calculationRunId: runId, biogenicCo2e: { not: null } },
        _sum: { biogenicCo2e: true },
        _count: { biogenicCo2e: true },
      }),
      prisma.emissionCalculation.findMany({
        where: { calculationRunId: runId, geometricStdDev: { not: null } },
        orderBy: { geometricStdDev: "desc" },
        take: 25,
        select: {
          id: true,
          activityRecordId: true,
          totalCo2e: true,
          dataQualityScore: true,
          geometricStdDev: true,
          pedigreeScores: true,
          temporalRepresentativenessYears: true,
          confidenceIntervalLower: true,
          confidenceIntervalUpper: true,
          activityRecord: {
            select: {
              emissionCategory: { select: { code: true, scope: true } },
              facility: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      runId,
      uncertainty,
      biogenic: {
        totalKgCo2e: biogenicAgg._sum.biogenicCo2e ?? 0,
        recordCount: biogenicAgg._count.biogenicCo2e,
      },
      weakestPedigreeRecords: worstRecords,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
