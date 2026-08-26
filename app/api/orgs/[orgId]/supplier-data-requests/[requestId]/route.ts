export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { runQualityChecks } from "@/lib/suppliers/quality-checks";
import { getExpectedUnits } from "@/lib/suppliers/validation-rules";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "flag_for_review"]),
  rejectionReason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

// GET /api/orgs/[orgId]/supplier-data-requests/[requestId] — fetch a single request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; requestId: string }> },
) {
  try {
    const { orgId, requestId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const request = await prisma.supplierDataRequest.findUnique({
      where: { id: requestId },
      include: {
        organization: { select: { name: true } },
        reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
        createdBy: { select: { name: true, email: true } },
        approvedBy: { select: { name: true, email: true } },
      },
    });

    if (!request || request.organizationId !== orgId) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Request not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: request.id,
      supplierEmail: request.supplierEmail,
      supplierName: request.supplierName,
      categoryCode: request.categoryCode,
      status: request.status,
      sentAt: request.sentAt.toISOString(),
      submittedAt: request.submittedAt?.toISOString() ?? null,
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      expiresAt: request.expiresAt.toISOString(),
      notes: request.notes,
      submittedData: request.submittedData,
      qualityFlags: request.qualityFlags,
      rejectionReason: request.rejectionReason,
      organization: request.organization.name,
      period: request.reportingPeriod.label,
      createdBy: { name: request.createdBy.name, email: request.createdBy.email },
      approvedBy: request.approvedBy ? { name: request.approvedBy.name, email: request.approvedBy.email } : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// PATCH /api/orgs/[orgId]/supplier-data-requests/[requestId] — review/approve/reject
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; requestId: string }> },
) {
  try {
    const { orgId, requestId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = reviewSchema.parse(await req.json());

    const request = await prisma.supplierDataRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.organizationId !== orgId) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Request not found." }, { status: 404 });
    }

    if (!request.submittedData) {
      return NextResponse.json(
        { code: "INVALID_STATE", message: "No submitted data to review." },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submittedData = request.submittedData as any;
    const quantity = submittedData.quantity || 0;
    const unit = submittedData.unit || "";
    const expectedUnits = getExpectedUnits(request.categoryCode);

    // Run quality checks
    const qualityCheckResult = await runQualityChecks(
      orgId,
      requestId,
      request.supplierEmail,
      request.reportingPeriodId,
      request.categoryCode,
      quantity,
      unit,
      expectedUnits,
    );

    let newStatus = request.status;
    let approvedByUserId: string | null = null;

    if (body.action === "approve") {
      // Only approve if there are no critical/warning flags
      if (qualityCheckResult.approved || !qualityCheckResult.flags.some((f) => f.severity !== "info")) {
        newStatus = "approved";
        approvedByUserId = session.user.id;
      } else {
        // If there are quality issues, move to flagged status instead of approving
        newStatus = "flagged";
      }
    } else if (body.action === "reject") {
      newStatus = "rejected";
      approvedByUserId = session.user.id;
    } else if (body.action === "flag_for_review") {
      newStatus = "flagged";
    }

    // Update the request
    const updated = await prisma.supplierDataRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        qualityFlags: qualityCheckResult.flags as any,
        rejectionReason: body.rejectionReason ?? null,
        approvedByUserId,
      },
    });

    // Fetch approvedBy separately if needed
    const approvedByUser = approvedByUserId
      ? await prisma.user.findUnique({
          where: { id: approvedByUserId },
          select: { name: true, email: true },
        })
      : null;

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: `supplier_data_request.${body.action}`,
      resourceType: "SupplierDataRequest",
      resourceId: requestId,
      metadata: {
        previousStatus: request.status,
        newStatus,
        supplierEmail: request.supplierEmail,
        categoryCode: request.categoryCode,
        qualityFlagCount: qualityCheckResult.flags.length,
        rejectionReason: body.rejectionReason,
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      qualityFlags: updated.qualityFlags,
      rejectionReason: updated.rejectionReason,
      approvedBy: approvedByUser ? { name: approvedByUser.name, email: approvedByUser.email } : null,
      message: `Request ${body.action}ed successfully. Quality flags: ${qualityCheckResult.flags.length}`,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
