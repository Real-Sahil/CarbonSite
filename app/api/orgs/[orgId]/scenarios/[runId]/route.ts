export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; runId: string }> };

function sumByScope(
  rows: { totalCo2e: { toString(): string }; activityRecord: { emissionCategory: { scope: number } } }[],
) {
  const out = { scope1: 0, scope2: 0, scope3: 0, total: 0 };
  for (const row of rows) {
    const val = Number(row.totalCo2e);
    const scope = row.activityRecord.emissionCategory.scope;
    out.total += val;
    if (scope === 1) out.scope1 += val;
    else if (scope === 2) out.scope2 += val;
    else if (scope === 3) out.scope3 += val;
  }
  return out;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, runId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const run = await prisma.scenarioRun.findUnique({
      where: { id: runId },
      include: {
        createdBy: { select: { name: true, email: true } },
        drafts: {
          include: {
            activityRecord: {
              select: {
                id: true,
                emissionCategoryId: true,
                facilityId: true,
                emissionCategory: { select: { scope: true, name: true, code: true } },
              },
            },
          },
        },
      },
    });

    if (!run || run.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Scenario run not found.", 404);
    }

    // Fetch baseline emissions from the original calculation run
    const baselineEmissions = await prisma.emissionCalculation.findMany({
      where: { calculationRunId: run.calculationRunId, organizationId: orgId },
      select: {
        activityRecordId: true,
        totalCo2e: true,
        activityRecord: {
          select: {
            emissionCategory: { select: { scope: true } },
          },
        },
      },
    });

    // Build scope-level totals
    const baseline = sumByScope(baselineEmissions);
    const scenario = sumByScope(run.drafts);

    const reduction = {
      scope1: baseline.scope1 - scenario.scope1,
      scope2: baseline.scope2 - scenario.scope2,
      scope3: baseline.scope3 - scenario.scope3,
      total: baseline.total - scenario.total,
      totalPercent:
        baseline.total > 0
          ? ((baseline.total - scenario.total) / baseline.total) * 100
          : 0,
    };

    // Build a lookup of baseline co2e per activity record
    const baselineByRecord = new Map<string, number>(
      baselineEmissions.map((e) => [e.activityRecordId, Number(e.totalCo2e)]),
    );

    // Top 10 biggest reductions across all drafts
    const topReductions = run.drafts
      .map((d) => {
        const baselineVal = baselineByRecord.get(d.activityRecordId) ?? 0;
        const scenarioVal = Number(d.totalCo2e);
        return {
          id: d.id,
          activityRecordId: d.activityRecordId,
          scope: d.activityRecord.emissionCategory.scope,
          categoryName: d.activityRecord.emissionCategory.name,
          categoryCode: d.activityRecord.emissionCategory.code,
          baselineCo2e: baselineVal,
          scenarioCo2e: scenarioVal,
          reduction: baselineVal - scenarioVal,
          reductionPercent:
            baselineVal > 0 ? ((baselineVal - scenarioVal) / baselineVal) * 100 : 0,
        };
      })
      .sort((a, b) => b.reduction - a.reduction)
      .slice(0, 10);

    return NextResponse.json({
      id: run.id,
      label: "Unnamed scenario",
      calculationRunId: run.calculationRunId,
      createdAt: run.createdAt,
      expiresAt: run.expiresAt,
      createdBy: run.createdBy,
      baseline,
      scenario,
      reduction,
      draftsCount: run.drafts.length,
      topReductions,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
