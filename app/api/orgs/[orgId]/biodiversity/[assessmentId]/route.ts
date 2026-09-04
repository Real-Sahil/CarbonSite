export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateAssessmentSchema, createParcelSchema } from "@/lib/validation/ecology";
import { assessNetGain, checkTradingRule } from "@/lib/ecology/biodiversity-metric";
import {
  computeParcelUnits,
  recalculateAssessment,
  totalsFromAssessment,
} from "@/lib/ecology/assessment";

type Params = { params: Promise<{ orgId: string; assessmentId: string }> };

const MANAGE_ROLES = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "project_manager",
  "editor",
] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, assessmentId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const assessment = await prisma.biodiversityAssessment.findFirst({
      where: { id: assessmentId, organizationId: orgId },
      include: {
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
        parcels: { orderBy: [{ stage: "asc" }, { module: "asc" }, { habitatType: "asc" }] },
        speciesRecords: { orderBy: { species: "asc" } },
        managementPlan: {
          include: { events: { orderBy: { monitoringYear: "asc" } } },
        },
      },
    });
    if (!assessment) return apiError("NOT_FOUND", "Assessment not found.", 404);

    const netGain = assessNetGain(totalsFromAssessment(assessment));

    // Trading rules: each baseline parcel that is lost must be answered by
    // compensation of the same distinctiveness or better. Reported per lost
    // parcel because that is how a planning officer checks it.
    const lostParcels = assessment.parcels.filter((p) => p.stage === "baseline");
    const replacements = assessment.parcels.filter(
      (p) => p.stage === "created" || p.stage === "enhanced",
    );

    const tradingChecks = lostParcels.map((lost) => {
      const candidates = replacements.filter((r) => r.module === lost.module);
      // The strongest replacement available in the same module decides whether
      // the loss is answered.
      const best = candidates.reduce<{ check: ReturnType<typeof checkTradingRule>; parcel: typeof lost } | null>(
        (acc, candidate) => {
          const check = checkTradingRule({
            lostDistinctiveness: lost.distinctiveness,
            lostBroadHabitat: lost.broadHabitat,
            replacementDistinctiveness: candidate.distinctiveness,
            replacementBroadHabitat: candidate.broadHabitat,
          });
          if (!acc || (check.satisfied && !acc.check.satisfied)) {
            return { check, parcel: candidate };
          }
          return acc;
        },
        null,
      );

      return {
        parcelId: lost.id,
        habitatType: lost.habitatType,
        distinctiveness: lost.distinctiveness,
        module: lost.module,
        satisfied: best?.check.satisfied ?? lost.distinctiveness === "very_low",
        reason:
          best?.check.reason ??
          (lost.distinctiveness === "very_low"
            ? "Very low distinctiveness habitat carries no compensation requirement."
            : "No replacement habitat has been proposed in this module."),
        replacementHabitat: best?.parcel.habitatType ?? null,
      };
    });

    return Response.json({
      ...assessment,
      netGain,
      tradingChecks,
      tradingRulesSatisfied: tradingChecks.every((c) => c.satisfied),
      parcels: assessment.parcels.map((p) => ({
        ...p,
        size: Number(p.size),
        units: Number(p.units),
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, assessmentId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const existing = await prisma.biodiversityAssessment.findFirst({
      where: { id: assessmentId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Assessment not found.", 404);

    const body = updateAssessmentSchema.parse(await req.json());

    // An assessment cannot be submitted or approved while it fails the metric.
    // Letting that through would put a non-compliant figure in front of a
    // planning authority under this platform's name.
    if (body.status === "submitted" || body.status === "approved") {
      const result = assessNetGain(totalsFromAssessment(existing));
      if (!result.meetsRequirement) {
        return apiError(
          "DOES_NOT_MEET_REQUIREMENT",
          `This assessment does not yet deliver net gain, so it cannot be marked ${body.status}. ${result.summary}`,
          422,
        );
      }
    }

    const assessment = await prisma.biodiversityAssessment.update({
      where: { id: assessmentId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.reference !== undefined && { reference: body.reference ?? null }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.planningAuthority !== undefined && {
          planningAuthority: body.planningAuthority ?? null,
        }),
        ...(body.planningReference !== undefined && {
          planningReference: body.planningReference ?? null,
        }),
        ...(body.assessmentDate !== undefined && { assessmentDate: body.assessmentDate ?? null }),
        ...(body.ecologistName !== undefined && { ecologistName: body.ecologistName ?? null }),
        ...(body.ecologistOrganisation !== undefined && {
          ecologistOrganisation: body.ecologistOrganisation ?? null,
        }),
        ...(body.securingMechanism !== undefined && {
          securingMechanism: body.securingMechanism,
        }),
        ...(body.securedFrom !== undefined && { securedFrom: body.securedFrom ?? null }),
        ...(body.notes !== undefined && { notes: body.notes ?? null }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action:
        body.status === "approved"
          ? "biodiversity.assessment_approved"
          : body.status === "submitted"
            ? "biodiversity.assessment_submitted"
            : "biodiversity.assessment_updated",
      resourceType: "BiodiversityAssessment",
      resourceId: assessment.id,
      metadata: { name: assessment.name, changedFields: Object.keys(body) },
    });

    return Response.json(assessment);
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Adds a habitat parcel and recomputes the assessment's position. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, assessmentId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const assessment = await prisma.biodiversityAssessment.findFirst({
      where: { id: assessmentId, organizationId: orgId },
      select: { id: true, name: true, status: true },
    });
    if (!assessment) return apiError("NOT_FOUND", "Assessment not found.", 404);

    if (assessment.status === "approved" || assessment.status === "superseded") {
      return apiError(
        "ASSESSMENT_LOCKED",
        "An approved assessment is the basis of a planning consent and cannot be edited. Create a revision instead.",
        409,
      );
    }

    const body = createParcelSchema.parse(await req.json());

    // Units are always derived, never taken from the request.
    const { units, calculation } = computeParcelUnits(body);

    const parcel = await prisma.habitatParcel.create({
      data: {
        organizationId: orgId,
        assessmentId,
        stage: body.stage,
        module: body.module,
        broadHabitat: body.broadHabitat,
        habitatType: body.habitatType,
        size: body.size,
        distinctiveness: body.distinctiveness,
        condition: body.condition,
        strategicSignificance: body.strategicSignificance,
        difficulty: body.difficulty,
        yearsToTargetCondition: body.yearsToTargetCondition,
        spatialRisk: body.spatialRisk,
        units,
        calculation,
        parcelReference: body.parcelReference ?? null,
        notes: body.notes ?? null,
      },
    });

    const updated = await recalculateAssessment(orgId, assessmentId);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "biodiversity.parcel_created",
      resourceType: "HabitatParcel",
      resourceId: parcel.id,
      metadata: {
        assessmentName: assessment.name,
        stage: parcel.stage,
        module: parcel.module,
        habitatType: parcel.habitatType,
        units,
        calculation,
      },
    });

    return Response.json(
      {
        ...parcel,
        size: Number(parcel.size),
        units: Number(parcel.units),
        netGain: assessNetGain(totalsFromAssessment(updated)),
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
