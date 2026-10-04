export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { aiAssistEnabled } from "@/lib/llm/org-consent";
import { narrativeBody } from "@/lib/reports/narrative-store";

type Ctx = { params: Promise<{ orgId: string; periodId: string }> };

const periodOf = (orgId: string, periodId: string) =>
  prisma.reportingPeriod.findFirst({ where: { id: periodId, organizationId: orgId }, select: { id: true, label: true } });

// GET: the saved narrative for a period, and whether a grounded AI draft is on offer.
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, periodId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.reviewersAndEditors);
    const period = await periodOf(orgId, periodId);
    if (!period) return apiError("NOT_FOUND", "Reporting period not found.", 404);
    const [row, aiAvailable] = await Promise.all([
      prisma.reportNarrative.findFirst({ where: { organizationId: orgId, reportingPeriodId: period.id } }),
      aiAssistEnabled(orgId),
    ]);
    return NextResponse.json({
      period,
      aiAvailable,
      narrative: row
        ? { executiveSummary: row.executiveSummary, keyFindings: row.keyFindings, recommendations: row.recommendations, aiDrafted: row.aiDrafted, updatedAt: row.updatedAt }
        : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// PUT: save the team's own narrative for a period (editors).
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, periodId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = narrativeBody.parse(await req.json());
    const period = await periodOf(orgId, periodId);
    if (!period) return apiError("NOT_FOUND", "Reporting period not found.", 404);
    const data = { executiveSummary: body.executiveSummary, keyFindings: body.keyFindings, recommendations: body.recommendations, aiDrafted: body.aiDrafted, updatedByUserId: session.user.id };
    await prisma.reportNarrative.upsert({
      where: { organizationId_reportingPeriodId: { organizationId: orgId, reportingPeriodId: period.id } },
      create: { organizationId: orgId, reportingPeriodId: period.id, ...data },
      update: data,
    });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "report_narrative.saved", resourceType: "ReportNarrative", resourceId: period.id,
      metadata: { aiDrafted: body.aiDrafted, findings: body.keyFindings.length },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE: back to generated wording (or none) for the period (editors).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, periodId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const period = await periodOf(orgId, periodId);
    if (!period) return apiError("NOT_FOUND", "Reporting period not found.", 404);
    await prisma.reportNarrative.deleteMany({ where: { organizationId: orgId, reportingPeriodId: period.id } });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "report_narrative.deleted", resourceType: "ReportNarrative", resourceId: period.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
