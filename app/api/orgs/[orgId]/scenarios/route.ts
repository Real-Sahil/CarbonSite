export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import type { Prisma } from "@prisma/client";

const createScenarioSchema = z.object({
  calculationRunId: z.string().min(1),
  label: z.string().max(255).optional(),
  adjustments: z
    .array(
      z.object({
        scope: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        categoryId: z.string().optional(),
        facilityId: z.string().optional(),
        reductionPercent: z.number().min(0).max(100),
      }),
    )
    .min(1)
    .max(50),
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const runs = await prisma.scenarioRun.findMany({
      where: { organizationId: orgId },
      include: {
        createdBy: { select: { name: true, email: true } },
        calculationRun: {
          select: {
            id: true,
            status: true,
            reportingPeriod: { select: { label: true } },
          },
        },
        _count: { select: { drafts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ data: runs });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const body = createScenarioSchema.parse(await req.json());

    // Verify the calculation run belongs to this org and has completed successfully
    const calcRun = await prisma.calculationRun.findUnique({
      where: { id: body.calculationRunId },
      select: { organizationId: true, status: true },
    });
    if (!calcRun || calcRun.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Calculation run not found.", 404);
    }
    if (calcRun.status !== "succeeded") {
      return apiError(
        "INVALID_STATE",
        "Scenario modeling requires a succeeded calculation run.",
        422,
      );
    }

    // Load baseline emissions with scope via activity record -> emission category
    const emissions = await prisma.emissionCalculation.findMany({
      where: { calculationRunId: body.calculationRunId, organizationId: orgId },
      include: {
        activityRecord: {
          select: {
            id: true,
            emissionCategoryId: true,
            facilityId: true,
            emissionCategory: { select: { scope: true } },
          },
        },
      },
    });

    if (emissions.length === 0) {
      return apiError("NO_DATA", "No emission calculations found for this run.", 422);
    }

    // Create scenario run (expires in 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const scenarioRun = await prisma.scenarioRun.create({
      data: {
        organizationId: orgId,
        calculationRunId: body.calculationRunId,
        createdByUserId: session.user.id,
        expiresAt,
      },
    });

    // Apply adjustments and build draft rows
    const drafts: Prisma.ScenarioDraftCreateManyInput[] = [];
    let baselineTotal = 0;
    let scenarioTotal = 0;

    for (const emission of emissions) {
      const scope = emission.activityRecord.emissionCategory.scope;
      const categoryId = emission.activityRecord.emissionCategoryId;
      const facilityId = emission.activityRecord.facilityId;

      // Combine all matching adjustments multiplicatively so multiple
      // adjustments on the same record compose rather than overwrite.
      let retentionFactor = 1.0;
      for (const adj of body.adjustments) {
        const scopeMatch = adj.scope === undefined || adj.scope === scope;
        const categoryMatch = adj.categoryId === undefined || adj.categoryId === categoryId;
        const facilityMatch = adj.facilityId === undefined || adj.facilityId === facilityId;
        if (scopeMatch && categoryMatch && facilityMatch) {
          retentionFactor *= 1 - adj.reductionPercent / 100;
        }
      }

      const origTotalCo2e = Number(emission.totalCo2e);
      const origNormalizedAmount = Number(emission.normalizedAmount);

      const newTotalCo2e = origTotalCo2e * retentionFactor;
      const newNormalizedAmount = origNormalizedAmount * retentionFactor;

      baselineTotal += origTotalCo2e;
      scenarioTotal += newTotalCo2e;

      const reductionPct = Math.round((1 - retentionFactor) * 100);

      drafts.push({
        organizationId: orgId,
        scenarioRunId: scenarioRun.id,
        activityRecordId: emission.activityRecordId,
        emissionFactorId: emission.emissionFactorId ?? null,
        originalAmount: emission.originalAmount,
        originalUnit: emission.originalUnit,
        normalizedAmount: newNormalizedAmount,
        normalizedUnit: emission.normalizedUnit,
        co2: emission.co2 !== null ? Number(emission.co2) * retentionFactor : null,
        ch4: emission.ch4 !== null ? Number(emission.ch4) * retentionFactor : null,
        n2o: emission.n2o !== null ? Number(emission.n2o) * retentionFactor : null,
        totalCo2e: newTotalCo2e,
        selectionReason: emission.selectionReason ?? null,
        factorValue: emission.factorValue ? Number(emission.factorValue) : null,
        formula: `hypothetical(${reductionPct}% reduction): ${emission.formula}`,
        warnings: emission.warnings as Prisma.InputJsonValue,
        dataQualityScore: emission.dataQualityScore,
        confidenceIntervalLower: emission.confidenceIntervalLower
          ? Number(emission.confidenceIntervalLower) * retentionFactor
          : null,
        confidenceIntervalUpper: emission.confidenceIntervalUpper
          ? Number(emission.confidenceIntervalUpper) * retentionFactor
          : null,
      });
    }

    await prisma.scenarioDraft.createMany({ data: drafts });

    const reductionTotal = baselineTotal - scenarioTotal;
    const reductionPercent =
      baselineTotal > 0 ? (reductionTotal / baselineTotal) * 100 : 0;

    return NextResponse.json(
      {
        id: scenarioRun.id,
        calculationRunId: scenarioRun.calculationRunId,
        createdAt: scenarioRun.createdAt,
        expiresAt: scenarioRun.expiresAt,
        baselineTotal,
        scenarioTotal,
        reduction: reductionTotal,
        reductionPercent,
        draftsCount: drafts.length,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
