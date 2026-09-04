export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateSubcontractorSubmissionSchema } from "@/lib/validation/project-carbon";

type Params = { params: Promise<{ orgId: string; contractId: string; submissionId: string }> };

async function findScopedSubmission(orgId: string, contractId: string, submissionId: string) {
  return prisma.subcontractorCarbonSubmission.findFirst({
    where: { id: submissionId, contractId, organizationId: orgId },
  });
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, submissionId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const submission = await findScopedSubmission(orgId, contractId, submissionId);
    if (!submission) return apiError("NOT_FOUND", "Subcontractor submission not found.", 404);

    return NextResponse.json({ submission });
  } catch (err) {
    return handleRouteError(err);
  }
}

// PATCH drives the requested -> submitted -> verified|rejected workflow.
// "submit" records the data the org received from the subcontractor
// (there is no public subcontractor-facing portal yet — data is logged by
// the project/site team from what the subcontractor sent). "verify" and
// "reject" are a separate, higher-trust compliance sign-off step.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, submissionId } = await params;

    const body = await req.json().catch(() => null);
    const parsed = updateSubcontractorSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid subcontractor submission update.", 400, parsed.error.flatten());
    }
    const data = parsed.data;

    if (data.action === "submit") {
      const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.projectManagers);
      const existing = await findScopedSubmission(orgId, contractId, submissionId);
      if (!existing) return apiError("NOT_FOUND", "Subcontractor submission not found.", 404);
      if (existing.status === "verified") {
        return apiError("ALREADY_VERIFIED", "This submission has already been verified.", 409);
      }

      const submission = await prisma.subcontractorCarbonSubmission.update({
        where: { id: submissionId },
        data: {
          status: "submitted",
          scope1Tco2e: data.scope1Tco2e,
          scope2Tco2e: data.scope2Tco2e,
          scope3Tco2e: data.scope3Tco2e,
          evidenceStorageKey: data.evidenceStorageKey,
          notes: data.notes ?? existing.notes,
          submittedAt: new Date(),
          rejectionReason: null,
        },
      });

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "subcontractor_submission.submitted",
        resourceType: "SubcontractorCarbonSubmission",
        resourceId: submissionId,
        metadata: {
          scope1Tco2e: data.scope1Tco2e,
          scope2Tco2e: data.scope2Tco2e,
          scope3Tco2e: data.scope3Tco2e,
        },
      });

      return NextResponse.json({ submission });
    }

    if (data.action === "verify") {
      const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.contractManagers);
      const existing = await findScopedSubmission(orgId, contractId, submissionId);
      if (!existing) return apiError("NOT_FOUND", "Subcontractor submission not found.", 404);
      if (existing.status !== "submitted") {
        return apiError(
          "INVALID_STATUS",
          `Cannot verify a submission with status "${existing.status}" — it must be submitted first.`,
          422,
        );
      }

      const submission = await prisma.subcontractorCarbonSubmission.update({
        where: { id: submissionId },
        data: { status: "verified", verifiedByUserId: session.user.id, verifiedAt: new Date() },
      });

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "subcontractor_submission.verified",
        resourceType: "SubcontractorCarbonSubmission",
        resourceId: submissionId,
        metadata: {},
      });

      return NextResponse.json({ submission });
    }

    // action === "reject"
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.contractManagers);
    const existing = await findScopedSubmission(orgId, contractId, submissionId);
    if (!existing) return apiError("NOT_FOUND", "Subcontractor submission not found.", 404);
    if (existing.status !== "submitted") {
      return apiError(
        "INVALID_STATUS",
        `Cannot reject a submission with status "${existing.status}" — it must be submitted first.`,
        422,
      );
    }

    const submission = await prisma.subcontractorCarbonSubmission.update({
      where: { id: submissionId },
      data: { status: "rejected", rejectionReason: data.rejectionReason },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "subcontractor_submission.rejected",
      resourceType: "SubcontractorCarbonSubmission",
      resourceId: submissionId,
      metadata: { rejectionReason: data.rejectionReason },
    });

    return NextResponse.json({ submission });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, submissionId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.contractManagers);

    const existing = await findScopedSubmission(orgId, contractId, submissionId);
    if (!existing) return apiError("NOT_FOUND", "Subcontractor submission not found.", 404);

    await prisma.subcontractorCarbonSubmission.delete({ where: { id: submissionId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
