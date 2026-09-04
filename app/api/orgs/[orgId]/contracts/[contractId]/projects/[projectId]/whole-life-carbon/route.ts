export const dynamic = "force-dynamic";

// Whole-life carbon (EN 15978 modules A-D) for a project. A-stages and
// end-of-life stages are recomputed per EmbodiedCarbonRecord from its
// underlying material/EPD factors and lifecycle stage selection (the
// stored totalKgCo2e mixes whatever stages the record was created with, so
// it can't be split cleanly after the fact) — B6 is the project's real
// measured Scope 1+2 emissions on its own sites; see
// lib/embodied-carbon/whole-life.ts for the full methodology notes.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { setWholeLifeCarbonAssessmentSchema } from "@/lib/validation/project-carbon";
import { calculateEmbodiedCarbon, type LifecycleStage, type MaterialGwpFactors } from "@/lib/embodied-carbon/engine";
import { computeWholeLifeCarbon, type WholeLifeMaterialInput } from "@/lib/embodied-carbon/whole-life";

type Params = { params: Promise<{ orgId: string; contractId: string; projectId: string }> };

const A_STAGES: LifecycleStage[] = ["A1-A3", "A4", "A5"];
const C_STAGES: LifecycleStage[] = ["C1-C4", "C1", "C2", "C3", "C4"];

async function computeOperationalEnergyKgCo2e(
  orgId: string,
  projectId: string,
  operationalStartDate: Date | null,
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ total_co2e: number }>>`
    SELECT COALESCE(SUM(ec.total_co2e), 0)::float AS total_co2e
    FROM activity_records ar
    JOIN sites s ON s.id = ar.site_id
    JOIN emission_categories cat ON cat.id = ar.emission_category_id
    LEFT JOIN LATERAL (
      SELECT total_co2e FROM emission_calculations
      WHERE activity_record_id = ar.id
      ORDER BY created_at DESC LIMIT 1
    ) ec ON TRUE
    WHERE s.project_id = ${projectId}
      AND ar.organization_id = ${orgId}
      AND ar.review_status = 'approved'
      AND cat.scope IN (1, 2)
      AND (${operationalStartDate}::date IS NULL OR ar.activity_date >= ${operationalStartDate}::date)
  `;
  return Number(rows[0]?.total_co2e ?? 0);
}

async function loadWholeLifeMaterials(
  orgId: string,
  projectId: string,
): Promise<{ materials: WholeLifeMaterialInput[]; warnings: string[] }> {
  const records = await prisma.embodiedCarbonRecord.findMany({
    where: { organizationId: orgId, projectId },
    include: { material: true, epd: true },
  });

  const warnings: string[] = [];
  let unlinkedCount = 0;
  let noReplacementCycleCount = 0;

  const materials = records.map((record) => {
    const label = record.epd?.productName ?? record.material?.name ?? record.description ?? "Unnamed record";
    const source = record.epd ?? record.material;
    if (!source) {
      // A custom record with neither material nor EPD has no factors to
      // recompute a stage split from — treat its whole stored total as A-stage.
      unlinkedCount++;
      return {
        embodiedTotalKgCo2e: record.totalKgCo2e,
        endOfLifeKgCo2e: 0,
        moduleDKgCo2e: 0,
        replacementCycleYears: null,
      };
    }

    const factors: MaterialGwpFactors = {
      gwpA1A3: source.gwpA1A3,
      gwpA4: source.gwpA4,
      gwpA5: source.gwpA5,
      gwpC1C4: source.gwpC1C4,
      gwpC1: source.gwpC1,
      gwpC2: source.gwpC2,
      gwpC3: source.gwpC3,
      gwpC4: source.gwpC4,
      gwpD: source.gwpD,
      declaredUnit: source.declaredUnit,
      density: record.material?.density ?? null,
    };

    const recordStages = record.lifecycleStages as LifecycleStage[];
    const aStages = recordStages.filter((s) => A_STAGES.includes(s));
    const cStages = recordStages.filter((s) => C_STAGES.includes(s));
    const dStages = recordStages.includes("D") ? (["D"] as LifecycleStage[]) : [];

    let embodiedTotalKgCo2e = 0;
    if (aStages.length > 0) {
      const aResult = calculateEmbodiedCarbon({ quantity: record.quantity, unit: record.unit, factors, stages: aStages });
      embodiedTotalKgCo2e = aResult.totalKgCo2e;
      for (const w of aResult.warnings) warnings.push(`${label}: ${w}`);
    }

    let endOfLifeKgCo2e = 0;
    if (cStages.length > 0) {
      const cResult = calculateEmbodiedCarbon({ quantity: record.quantity, unit: record.unit, factors, stages: cStages });
      endOfLifeKgCo2e = cResult.totalKgCo2e;
      for (const w of cResult.warnings) warnings.push(`${label}: ${w}`);
    }

    const moduleDKgCo2e =
      dStages.length > 0
        ? calculateEmbodiedCarbon({ quantity: record.quantity, unit: record.unit, factors, stages: dStages }).totalKgCo2e
        : 0;

    const replacementCycleYears = ("replacementCycleYears" in source ? source.replacementCycleYears : null) ?? null;
    if (replacementCycleYears == null) noReplacementCycleCount++;

    return {
      embodiedTotalKgCo2e,
      endOfLifeKgCo2e,
      moduleDKgCo2e,
      replacementCycleYears,
    };
  });

  if (unlinkedCount > 0) {
    warnings.push(
      `${unlinkedCount} embodied carbon record${unlinkedCount === 1 ? " has" : "s have"} no material or EPD linked, so end-of-life and replacement impact could not be split out for ${unlinkedCount === 1 ? "it" : "them"} — treated entirely as A-stage.`,
    );
  }
  if (noReplacementCycleCount > 0) {
    warnings.push(
      `${noReplacementCycleCount} material${noReplacementCycleCount === 1 ? "" : "s"} on this project have no replacement cycle recorded, so module B4 (replacement) is not modelled for ${noReplacementCycleCount === 1 ? "it" : "them"} — assumed to last the whole assessment period.`,
    );
  }

  return { materials, warnings };
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const project = await prisma.project.findFirst({ where: { id: projectId, contractId, organizationId: orgId } });
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const assessment = await prisma.wholeLifeCarbonAssessment.findUnique({ where: { projectId } });
    const assessmentPeriodYears = assessment?.assessmentPeriodYears ?? 60;
    const operationalStartDate = assessment?.operationalStartDate ?? null;

    const [{ materials, warnings: materialWarnings }, operationalEnergyKgCo2e] = await Promise.all([
      loadWholeLifeMaterials(orgId, projectId),
      computeOperationalEnergyKgCo2e(orgId, projectId, operationalStartDate),
    ]);

    const result = computeWholeLifeCarbon({
      materials,
      assessmentPeriodYears,
      operationalEnergyKgCo2e,
      operationalWaterKgCo2e: assessment?.operationalWaterKgCo2eManual
        ? Number(assessment.operationalWaterKgCo2eManual)
        : null,
    });
    result.warnings.push(...materialWarnings);

    return NextResponse.json({ assessment, result, materialRecordCount: materials.length });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);

    const project = await prisma.project.findFirst({ where: { id: projectId, contractId, organizationId: orgId } });
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const body = await req.json().catch(() => null);
    const parsed = setWholeLifeCarbonAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid whole-life carbon assessment data.", 400, parsed.error.flatten());
    }
    const data = parsed.data;

    const assessment = await prisma.wholeLifeCarbonAssessment.upsert({
      where: { projectId },
      create: {
        organizationId: orgId,
        projectId,
        assessmentPeriodYears: data.assessmentPeriodYears,
        operationalStartDate: data.operationalStartDate ?? null,
        operationalWaterKgCo2eManual: data.operationalWaterKgCo2eManual ?? null,
        notes: data.notes ?? null,
        createdByUserId: session.user.id,
      },
      update: {
        assessmentPeriodYears: data.assessmentPeriodYears,
        operationalStartDate: data.operationalStartDate ?? null,
        operationalWaterKgCo2eManual: data.operationalWaterKgCo2eManual ?? null,
        notes: data.notes ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "whole_life_carbon.assessment_set",
      resourceType: "WholeLifeCarbonAssessment",
      resourceId: assessment.id,
      metadata: { projectId, assessmentPeriodYears: data.assessmentPeriodYears },
    });

    return NextResponse.json({ assessment });
  } catch (err) {
    return handleRouteError(err);
  }
}
