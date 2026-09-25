export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { parseSections } from "@/lib/crp/plan";

const READ_ROLES = [...ROLE_GROUPS.editor, "reviewer", "viewer", "auditor"] as const;

// GET /api/orgs/[orgId]/carbon-reduction-plans: one plan per reporting period.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...READ_ROLES);
    const plans = await prisma.carbonReductionPlan.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, status: true, updatedAt: true, lastReportId: true, reportingPeriod: { select: { id: true, label: true } } },
    });
    return NextResponse.json({ plans });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({ reportingPeriodId: z.string().min(1) });

// POST /api/orgs/[orgId]/carbon-reduction-plans: start (or reopen) the plan
// for a period. A period has one plan; asking again returns it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = createSchema.parse(await req.json());

    const period = await prisma.reportingPeriod.findFirst({
      where: { id: body.reportingPeriodId, organizationId: orgId },
      select: { id: true },
    });
    if (!period) return apiError("NOT_FOUND", "Reporting period not found in this organisation.", 404);

    const existing = await prisma.carbonReductionPlan.findUnique({
      where: { organizationId_reportingPeriodId: { organizationId: orgId, reportingPeriodId: period.id } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ plan: existing, created: false });

    // Carry the text that rarely changes year to year over from the latest
    // plan, so next year's plan starts from this year's.
    const previous = await prisma.carbonReductionPlan.findFirst({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      select: { sections: true },
    });
    const prev = previous ? parseSections(previous.sections) : null;
    const sections = prev
      ? {
          organisation: prev.organisation,
          baseline: prev.baseline,
          targets: prev.targets,
          measures: prev.measures,
          scope3: prev.scope3,
          secr: { ...prev.secr, intensityValue: "" },
          declaration: { signatoryName: prev.declaration.signatoryName, signatoryTitle: prev.declaration.signatoryTitle },
        }
      : {};

    const plan = await prisma.carbonReductionPlan.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: period.id,
        sections: parseSections(sections),
        createdByUserId: session.user.id,
        updatedByUserId: session.user.id,
      },
      select: { id: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "carbon_reduction_plan.created",
      resourceType: "CarbonReductionPlan",
      resourceId: plan.id,
      metadata: { reportingPeriodId: period.id, carriedOver: !!prev },
    });

    return NextResponse.json({ plan, created: true }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
