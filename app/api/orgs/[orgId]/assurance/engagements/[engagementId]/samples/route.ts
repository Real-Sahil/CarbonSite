export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { generateSamplingPlanSchema, createManualSampleSchema } from "@/lib/validation/assurance";
import { buildSamplingPlan, suggestMaterialityThreshold } from "@/lib/assurance/sampling";

type Params = { params: Promise<{ orgId: string; engagementId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "auditor"] as const;

/**
 * Generates a stratified sample from the engagement's snapshot: full
 * population above materiality, then the weakest data provenance tiers, then
 * a random top-up. Existing samples for this engagement are left alone so
 * the plan can be regenerated to top up rather than starting over.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, engagementId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const engagement = await prisma.assuranceEngagement.findFirst({
      where: { id: engagementId, organizationId: orgId },
      select: {
        id: true,
        status: true,
        reportingPeriodId: true,
        materialityThresholdCo2e: true,
      },
    });
    if (!engagement) return apiError("NOT_FOUND", "Engagement not found.", 404);
    if (engagement.status === "signed" || engagement.status === "withdrawn") {
      return apiError("ENGAGEMENT_CLOSED", `This engagement is ${engagement.status}.`, 409);
    }

    const body = generateSamplingPlanSchema.parse(await req.json());

    const calculations = await prisma.emissionCalculation.findMany({
      where: { organizationId: orgId, activityRecord: { reportingPeriodId: engagement.reportingPeriodId } },
      select: {
        id: true,
        activityRecordId: true,
        totalCo2e: true,
        activityRecord: { select: { dataOrigin: true } },
      },
      take: 20_000,
    });

    if (calculations.length === 0) {
      return apiError("NO_DATA", "No emission calculations found for this reporting period to sample from.", 422);
    }

    const alreadySampled = await prisma.assuranceSample.findMany({
      where: { engagementId },
      select: { emissionCalculationId: true },
    });
    const alreadySampledIds = new Set(alreadySampled.map((s) => s.emissionCalculationId).filter(Boolean));

    const totalCo2e = calculations.reduce((sum, c) => sum + Number(c.totalCo2e), 0);
    const materialityThreshold =
      body.materialityThresholdCo2e ??
      (engagement.materialityThresholdCo2e ? Number(engagement.materialityThresholdCo2e) : suggestMaterialityThreshold(totalCo2e));

    const plan = buildSamplingPlan({
      candidates: calculations
        .filter((c) => !alreadySampledIds.has(c.id))
        .map((c) => ({
          id: c.id,
          activityRecordId: c.activityRecordId,
          dataOrigin: c.activityRecord.dataOrigin,
          totalCo2e: Number(c.totalCo2e),
        })),
      materialityThresholdCo2e: materialityThreshold,
      targetSampleSize: body.targetSampleSize,
    });

    if (plan.length === 0) {
      return Response.json({ created: [], materialityThresholdUsed: materialityThreshold });
    }

    const created = await prisma.$transaction(
      plan.map((item) =>
        prisma.assuranceSample.create({
          data: {
            organizationId: orgId,
            engagementId,
            emissionCalculationId: item.emissionCalculationId,
            activityRecordId: item.activityRecordId,
            samplingMethod: item.samplingMethod,
            selectionRationale: item.selectionRationale,
            testProcedure: item.testProcedure,
          },
        }),
      ),
    );

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.sample_created",
      resourceType: "AssuranceEngagement",
      resourceId: engagementId,
      metadata: {
        sampleCount: created.length,
        materialityThresholdUsed: materialityThreshold,
        byMethod: {
          full_population: plan.filter((p) => p.samplingMethod === "full_population").length,
          risk_based: plan.filter((p) => p.samplingMethod === "risk_based").length,
          random: plan.filter((p) => p.samplingMethod === "random").length,
        },
      },
    });

    return Response.json({ created: created.length, materialityThresholdUsed: materialityThreshold }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Adds a single manually-selected sample item, for a targeted test. */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId, engagementId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const engagement = await prisma.assuranceEngagement.findFirst({
      where: { id: engagementId, organizationId: orgId },
      select: { id: true, status: true },
    });
    if (!engagement) return apiError("NOT_FOUND", "Engagement not found.", 404);
    if (engagement.status === "signed" || engagement.status === "withdrawn") {
      return apiError("ENGAGEMENT_CLOSED", `This engagement is ${engagement.status}.`, 409);
    }

    const body = createManualSampleSchema.parse(await req.json());

    if (body.emissionCalculationId) {
      const calc = await prisma.emissionCalculation.findFirst({
        where: { id: body.emissionCalculationId, organizationId: orgId },
        select: { id: true },
      });
      if (!calc) return apiError("NOT_FOUND", "Emission calculation not found in this organisation.", 404);
    }

    const sample = await prisma.assuranceSample.create({
      data: {
        organizationId: orgId,
        engagementId,
        emissionCalculationId: body.emissionCalculationId ?? null,
        activityRecordId: body.activityRecordId ?? null,
        samplingMethod: body.samplingMethod,
        selectionRationale: body.selectionRationale,
        testProcedure: body.testProcedure,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.sample_created",
      resourceType: "AssuranceSample",
      resourceId: sample.id,
      metadata: { engagementId, samplingMethod: sample.samplingMethod },
    });

    return Response.json(sample, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
