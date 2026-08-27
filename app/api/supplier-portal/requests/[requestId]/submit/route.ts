import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { runQualityChecks } from "@/lib/suppliers/quality-checks";
import { getExpectedUnits } from "@/lib/suppliers/validation-rules";

const submitSchema = z.object({
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1),
  description: z.string().max(500).optional(),
});

// Supplier submits data for a request
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const { user, session } = await requireSession();
    const { requestId } = await params;
    const body = submitSchema.parse(await req.json());

    // Verify user is a supplier
    const supplierMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        role: "supplier",
        terminatedAt: null,
      },
      include: {
        organization: { select: { id: true } },
      },
    });

    if (!supplierMembership) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "You do not have access to submit data." },
        { status: 403 },
      );
    }

    // Get the request
    const request = await prisma.supplierDataRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.organizationId !== supplierMembership.organizationId) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Request not found." },
        { status: 404 },
      );
    }

    // Check if request is still open
    if (request.expiresAt < new Date() && request.status !== "rejected") {
      return NextResponse.json(
        { code: "INVALID_STATE", message: "This request has expired." },
        { status: 400 },
      );
    }

    if (!["sent", "opened", "rejected"].includes(request.status)) {
      return NextResponse.json(
        { code: "INVALID_STATE", message: "This request is not open for submission." },
        { status: 400 },
      );
    }

    // Run quality checks
    const expectedUnits = getExpectedUnits(request.categoryCode);
    const qualityCheckResult = await runQualityChecks(
      supplierMembership.organizationId,
      requestId,
      request.supplierEmail,
      request.reportingPeriodId,
      request.categoryCode,
      body.quantity,
      body.unit,
      expectedUnits,
    );

    // Determine status based on quality checks
    let newStatus = "submitted";
    if (!qualityCheckResult.approved && qualityCheckResult.flags.some((f) => f.severity !== "info")) {
      newStatus = "flagged";
    }

    // Update request with submission
    const updated = await prisma.supplierDataRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        submittedAt: new Date(),
        openedAt: request.openedAt || new Date(),
        submittedData: {
          quantity: body.quantity,
          unit: body.unit,
          description: body.description || null,
        },
        qualityFlags: qualityCheckResult.flags as never,
        notes: body.description || null,
      },
      include: {
        reportingPeriod: { select: { label: true } },
      },
    });

    // Audit log
    await writeAuditLog({
      organizationId: supplierMembership.organization.id,
      actorUserId: user.id,
      action: "supplier_data.submitted",
      resourceType: "SupplierDataRequest",
      resourceId: requestId,
      metadata: {
        supplierEmail: request.supplierEmail,
        categoryCode: request.categoryCode,
        quantity: body.quantity,
        unit: body.unit,
        submissionStatus: newStatus,
        qualityFlagCount: qualityCheckResult.flags.length,
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      submittedAt: updated.submittedAt?.toISOString(),
      qualityFlags: updated.qualityFlags,
      message:
        newStatus === "flagged"
          ? `Submission received with ${qualityCheckResult.flags.length} quality concern(s). Please review feedback.`
          : "Submission received successfully.",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
