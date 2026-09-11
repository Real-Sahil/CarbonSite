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

    const [calculations, waterRecords, wasteRecords] = await Promise.all([
      prisma.emissionCalculation.findMany({
        where: { organizationId: orgId, activityRecord: { reportingPeriodId: engagement.reportingPeriodId } },
        select: {
          id: true,
          activityRecordId: true,
          totalCo2e: true,
          activityRecord: { select: { dataOrigin: true } },
        },
        take: 20_000,
      }),
      prisma.waterRecord.findMany({
        where: { organizationId: orgId, reportingPeriodId: engagement.reportingPeriodId },
        select: { id: true, volumeM3: true, dataSource: true },
        take: 5_000,
      }),
      prisma.wasteRecord.findMany({
        where: { organizationId: orgId, reportingPeriodId: engagement.reportingPeriodId },
        select: { id: true, weightTonnes: true },
        take: 5_000,
      }),
    ]);

    if (calculations.length === 0 && waterRecords.length === 0 && wasteRecords.length === 0) {
      return apiError("NO_DATA", "No emission calculations or environmental records found for this reporting period to sample from.", 422);
    }

    const alreadySampled = await prisma.assuranceSample.findMany({
      where: { engagementId },
      select: { emissionCalculationId: true, waterRecordId: true, wasteRecordId: true },
    });
    const alreadySampledCalcIds = new Set(alreadySampled.map((s) => s.emissionCalculationId).filter(Boolean));
    const alreadySampledWaterIds = new Set(alreadySampled.map((s) => s.waterRecordId).filter(Boolean));
    const alreadySampledWasteIds = new Set(alreadySampled.map((s) => s.wasteRecordId).filter(Boolean));

    const totalCo2e = calculations.reduce((sum, c) => sum + Number(c.totalCo2e), 0);
    const materialityThreshold =
      body.materialityThresholdCo2e ??
      (engagement.materialityThresholdCo2e ? Number(engagement.materialityThresholdCo2e) : suggestMaterialityThreshold(totalCo2e));

    const calcCandidates = calculations
      .filter((c) => !alreadySampledCalcIds.has(c.id))
      .map((c) => ({
        id: c.id,
        activityRecordId: c.activityRecordId,
        dataOrigin: c.activityRecord.dataOrigin,
        totalCo2e: Number(c.totalCo2e),
      }));

    const plan = buildSamplingPlan({
      candidates: calcCandidates,
      materialityThresholdCo2e: materialityThreshold,
      targetSampleSize: body.targetSampleSize,
    });

    // Include a risk-based sample of water/waste records (up to 10% of target size each)
    const envSampleSize = Math.max(1, Math.floor((body.targetSampleSize ?? 25) * 0.1));
    const waterSamples = waterRecords
      .filter((r) => !alreadySampledWaterIds.has(r.id))
      .slice(0, envSampleSize);
    const wasteSamples = wasteRecords
      .filter((r) => !alreadySampledWasteIds.has(r.id))
      .slice(0, envSampleSize);

    if (plan.length === 0 && waterSamples.length === 0 && wasteSamples.length === 0) {
      return Response.json({ created: 0, materialityThresholdUsed: materialityThreshold });
    }

    const created = await prisma.$transaction([
      ...plan.map((item) =>
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
      ...waterSamples.map((r) =>
        prisma.assuranceSample.create({
          data: {
            organizationId: orgId,
            engagementId,
            waterRecordId: r.id,
            samplingMethod: "risk_based",
            selectionRationale: `Water record ${r.id}: ${Number(r.volumeM3).toFixed(1)} m³ (${r.dataSource})`,
            testProcedure: "Agree volume to meter reading or supporting evidence; verify facility water-stress classification.",
          },
        }),
      ),
      ...wasteSamples.map((r) =>
        prisma.assuranceSample.create({
          data: {
            organizationId: orgId,
            engagementId,
            wasteRecordId: r.id,
            samplingMethod: "risk_based",
            selectionRationale: `Waste record ${r.id}: ${Number(r.weightTonnes).toFixed(3)} tonnes`,
            testProcedure: "Agree weight to waste transfer note; verify disposal route, EWC code and hazardous classification.",
          },
        }),
      ),
    ]);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.sample_created",
      resourceType: "AssuranceEngagement",
      resourceId: engagementId,
      metadata: {
        sampleCount: created.length,
        materialityThresholdUsed: materialityThreshold,
        ghgSamples: plan.length,
        waterSamples: waterSamples.length,
        wasteSamples: wasteSamples.length,
        byMethod: {
          full_population: plan.filter((p) => p.samplingMethod === "full_population").length,
          risk_based: plan.filter((p) => p.samplingMethod === "risk_based").length + waterSamples.length + wasteSamples.length,
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

    if (body.waterRecordId) {
      const wr = await prisma.waterRecord.findFirst({
        where: { id: body.waterRecordId, organizationId: orgId },
        select: { id: true },
      });
      if (!wr) return apiError("NOT_FOUND", "Water record not found in this organisation.", 404);
    }

    if (body.wasteRecordId) {
      const wsr = await prisma.wasteRecord.findFirst({
        where: { id: body.wasteRecordId, organizationId: orgId },
        select: { id: true },
      });
      if (!wsr) return apiError("NOT_FOUND", "Waste record not found in this organisation.", 404);
    }

    const sample = await prisma.assuranceSample.create({
      data: {
        organizationId: orgId,
        engagementId,
        emissionCalculationId: body.emissionCalculationId ?? null,
        activityRecordId: body.activityRecordId ?? null,
        waterRecordId: body.waterRecordId ?? null,
        wasteRecordId: body.wasteRecordId ?? null,
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
