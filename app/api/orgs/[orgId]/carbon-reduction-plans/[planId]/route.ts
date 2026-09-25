export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { canGenerate, crpReadiness, crpSectionsSchema, parseSections } from "@/lib/crp/plan";
import { loadCrpContext } from "@/lib/crp/context";

type Params = { params: Promise<{ orgId: string; planId: string }> };
const READ_ROLES = [...ROLE_GROUPS.editor, "reviewer", "viewer", "auditor"] as const;

async function findPlan(orgId: string, planId: string) {
  return prisma.carbonReductionPlan.findFirst({ where: { id: planId, organizationId: orgId } });
}

// GET: the plan, the figures behind it and its PPN 006 readiness.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, planId } = await params;
    await requireOrgMember(orgId, ...READ_ROLES);
    const plan = await findPlan(orgId, planId);
    if (!plan) return apiError("NOT_FOUND", "Carbon Reduction Plan not found.", 404);
    const context = await loadCrpContext(orgId, plan.reportingPeriodId);
    if (!context) return apiError("NOT_FOUND", "Reporting period not found.", 404);
    const sections = parseSections(plan.sections);
    const checks = crpReadiness(sections, context);
    return NextResponse.json({ plan: { ...plan, sections }, context, checks, ready: canGenerate(checks) });
  } catch (err) {
    return handleRouteError(err);
  }
}

const patchSchema = z.object({
  sections: crpSectionsSchema.optional(),
  lastReportId: z.string().min(1).optional(),
});

// PATCH: save the plan's sections. A plan that was generated returns to
// draft when its text changes, so the published PDF is never mistaken for
// the current text.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, planId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const plan = await findPlan(orgId, planId);
    if (!plan) return apiError("NOT_FOUND", "Carbon Reduction Plan not found.", 404);
    const body = patchSchema.parse(await req.json());

    if (body.lastReportId) {
      const report = await prisma.report.findFirst({
        where: { id: body.lastReportId, organizationId: orgId, reportingPeriodId: plan.reportingPeriodId },
        select: { id: true },
      });
      if (!report) return apiError("NOT_FOUND", "Report not found for this plan's period.", 404);
    }

    const updated = await prisma.carbonReductionPlan.update({
      where: { id: plan.id },
      data: {
        ...(body.sections ? { sections: parseSections(body.sections), status: body.lastReportId ? "generated" : "draft" } : {}),
        ...(body.lastReportId ? { lastReportId: body.lastReportId, status: "generated" } : {}),
        updatedByUserId: session.user.id,
      },
      select: { id: true, status: true, updatedAt: true, lastReportId: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: body.lastReportId ? "carbon_reduction_plan.generated" : "carbon_reduction_plan.updated",
      resourceType: "CarbonReductionPlan",
      resourceId: plan.id,
      metadata: { reportingPeriodId: plan.reportingPeriodId, reportId: body.lastReportId ?? null },
    });

    return NextResponse.json({ plan: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
