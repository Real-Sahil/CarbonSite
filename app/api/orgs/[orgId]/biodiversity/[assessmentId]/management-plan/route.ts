export const dynamic = "force-dynamic";

// The management plan securing a net gain for its 30 year obligation, and the
// monitoring schedule generated from it.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createManagementPlanSchema } from "@/lib/validation/ecology";
import {
  buildMonitoringSchedule,
  BNG_SECURING_YEARS,
  DEFAULT_MONITORING_YEARS,
  assessNetGain,
} from "@/lib/ecology/biodiversity-metric";
import { totalsFromAssessment } from "@/lib/ecology/assessment";

type Params = { params: Promise<{ orgId: string; assessmentId: string }> };

const MANAGE_ROLES = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "project_manager",
] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, assessmentId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const plan = await prisma.habitatManagementPlan.findFirst({
      where: { assessmentId, organizationId: orgId },
      include: {
        events: {
          orderBy: { monitoringYear: "asc" },
          include: { parcel: { select: { habitatType: true, parcelReference: true } } },
        },
      },
    });
    if (!plan) return apiError("NOT_FOUND", "No management plan for this assessment.", 404);

    const now = new Date();
    const events = plan.events.map((e) => ({
      ...e,
      // Scheduled events whose date has passed without completion are overdue,
      // derived rather than stored so the register is right without a nightly
      // job having to run.
      derivedStatus:
        e.status === "scheduled" && e.dueOn.getTime() < now.getTime() ? "overdue" : e.status,
    }));

    return Response.json({
      ...plan,
      fundingSecured: plan.fundingSecured === null ? null : Number(plan.fundingSecured),
      events,
      summary: {
        total: events.length,
        completed: events.filter((e) => e.status === "completed").length,
        overdue: events.filter((e) => e.derivedStatus === "overdue").length,
        remediationRequired: events.filter((e) => e.status === "remediation_required").length,
        yearsRemaining: Math.max(
          0,
          Math.ceil((plan.endsOn.getTime() - now.getTime()) / (365.25 * 86_400_000)),
        ),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, assessmentId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const assessment = await prisma.biodiversityAssessment.findFirst({
      where: { id: assessmentId, organizationId: orgId },
      include: { managementPlan: { select: { id: true } } },
    });
    if (!assessment) return apiError("NOT_FOUND", "Assessment not found.", 404);
    if (assessment.managementPlan) {
      return apiError(
        "ALREADY_EXISTS",
        "This assessment already has a management plan.",
        409,
      );
    }

    // A management plan secures a net gain. Creating one for an assessment
    // that does not deliver net gain would secure a shortfall.
    const netGain = assessNetGain(totalsFromAssessment(assessment));
    if (!netGain.meetsRequirement) {
      return apiError(
        "DOES_NOT_MEET_REQUIREMENT",
        `A management plan secures a net gain over 30 years, but this assessment does not deliver one yet. ${netGain.summary}`,
        422,
      );
    }

    const body = createManagementPlanSchema.parse(await req.json());

    const endsOn = new Date(body.commencesOn);
    endsOn.setFullYear(endsOn.getFullYear() + BNG_SECURING_YEARS);

    const schedule = buildMonitoringSchedule(
      body.commencesOn,
      body.monitoringYears?.length ? body.monitoringYears : DEFAULT_MONITORING_YEARS,
    );

    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.habitatManagementPlan.create({
        data: {
          organizationId: orgId,
          assessmentId,
          title: body.title,
          responsibleParty: body.responsibleParty ?? null,
          commencesOn: body.commencesOn,
          endsOn,
          managementObjectives: body.managementObjectives ?? null,
          prescriptions: body.prescriptions ?? null,
          remediationStrategy: body.remediationStrategy ?? null,
          fundingSecured: body.fundingSecured ?? null,
          fundingCurrency: body.fundingCurrency ?? null,
          notes: body.notes ?? null,
          createdByUserId: session.user.id,
        },
      });

      await tx.ecologicalMonitoringEvent.createMany({
        data: schedule.map((s) => ({
          organizationId: orgId,
          managementPlanId: created.id,
          monitoringYear: s.year,
          dueOn: s.dueOn,
        })),
      });

      // The obligation runs from the plan's commencement, so record that on
      // the assessment too if it has not been set.
      await tx.biodiversityAssessment.update({
        where: { id: assessmentId },
        data: { securedFrom: assessment.securedFrom ?? body.commencesOn },
      });

      return created;
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "biodiversity.plan_created",
      resourceType: "HabitatManagementPlan",
      resourceId: plan.id,
      metadata: {
        assessmentId,
        commencesOn: plan.commencesOn.toISOString(),
        endsOn: plan.endsOn.toISOString(),
        monitoringEvents: schedule.length,
      },
    });

    return Response.json(
      {
        ...plan,
        fundingSecured: plan.fundingSecured === null ? null : Number(plan.fundingSecured),
        monitoringEventsCreated: schedule.length,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
