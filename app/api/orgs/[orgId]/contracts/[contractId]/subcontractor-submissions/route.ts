export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createSubcontractorSubmissionSchema } from "@/lib/validation/project-carbon";

type Params = { params: Promise<{ orgId: string; contractId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const contract = await prisma.contract.findFirst({ where: { id: contractId, organizationId: orgId } });
    if (!contract) return apiError("NOT_FOUND", "Contract not found.", 404);

    const now = new Date();
    // Mark past-due, still-requested submissions as overdue on read — no
    // background job needed for a status derived purely from the clock.
    await prisma.subcontractorCarbonSubmission.updateMany({
      where: { contractId, organizationId: orgId, status: "requested", dueDate: { lt: now } },
      data: { status: "overdue" },
    });

    const submissions = await prisma.subcontractorCarbonSubmission.findMany({
      where: { contractId, organizationId: orgId },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    const totals = submissions.reduce(
      (acc, s) => {
        if (s.status !== "verified") return acc;
        acc.scope1 += Number(s.scope1Tco2e ?? 0);
        acc.scope2 += Number(s.scope2Tco2e ?? 0);
        acc.scope3 += Number(s.scope3Tco2e ?? 0);
        return acc;
      },
      { scope1: 0, scope2: 0, scope3: 0 },
    );

    return NextResponse.json({
      submissions,
      verifiedTotals: totals,
      complianceRate:
        submissions.length > 0
          ? submissions.filter((s) => s.status === "verified").length / submissions.length
          : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.contractManagers);

    const contract = await prisma.contract.findFirst({ where: { id: contractId, organizationId: orgId } });
    if (!contract) return apiError("NOT_FOUND", "Contract not found.", 404);

    const body = await req.json().catch(() => null);
    const parsed = createSubcontractorSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid subcontractor submission request.", 400, parsed.error.flatten());
    }
    const data = parsed.data;

    const submission = await prisma.subcontractorCarbonSubmission.create({
      data: {
        organizationId: orgId,
        contractId,
        subcontractorName: data.subcontractorName,
        contactEmail: data.contactEmail,
        reportingPeriodLabel: data.reportingPeriodLabel,
        dueDate: data.dueDate,
        notes: data.notes,
        requestedByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "subcontractor_submission.requested",
      resourceType: "SubcontractorCarbonSubmission",
      resourceId: submission.id,
      metadata: { contractId, subcontractorName: data.subcontractorName, dueDate: data.dueDate },
    });

    return NextResponse.json({ submission }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
