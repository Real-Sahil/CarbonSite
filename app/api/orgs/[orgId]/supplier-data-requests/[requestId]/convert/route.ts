export const dynamic = "force-dynamic";

// Convert a submitted SupplierDataRequest into a committed ActivityRecord.
// Admin-only. Creates the record in draft review status so it goes through
// the normal review workflow before being included in a calculation run.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const bodySchema = z.object({
  // Admin can override quantity/unit before committing; defaults to submitted values.
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  notes: z.string().max(1000).trim().optional(),
});

type Params = { params: Promise<{ orgId: string; requestId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, requestId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const request = await prisma.supplierDataRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        organizationId: true,
        reportingPeriodId: true,
        supplierEmail: true,
        supplierName: true,
        categoryCode: true,
        status: true,
        submittedData: true,
      },
    });

    if (!request || request.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Supplier data request not found.", 404);
    }
    if (request.status !== "submitted") {
      return apiError(
        "NOT_SUBMITTED",
        "This request has not been submitted by the supplier yet.",
        409,
      );
    }

    const submitted = request.submittedData as {
      quantity: number;
      unit: string;
      description?: string | null;
    } | null;

    if (!submitted) {
      return apiError("NO_DATA", "No submitted data found on this request.", 422);
    }

    const body = bodySchema.parse(await req.json().catch(() => ({})));

    // Resolve emission category by code.
    const category = await prisma.emissionCategory.findUnique({
      where: { code: request.categoryCode },
      select: { id: true },
    });
    if (!category) {
      return apiError(
        "UNKNOWN_CATEGORY",
        `Emission category "${request.categoryCode}" not found. You may need to add a record manually.`,
        422,
      );
    }

    const quantity = body.quantity ?? submitted.quantity;
    const unit = body.unit ?? submitted.unit;
    const sourceDescription =
      body.notes ??
      submitted.description ??
      `Supplier data submission from ${request.supplierEmail}`;

    const record = await prisma.activityRecord.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: request.reportingPeriodId,
        emissionCategoryId: category.id,
        amount: quantity,
        unit,
        supplierName: request.supplierName ?? request.supplierEmail,
        sourceDescription,
        reviewStatus: "draft",
        evidenceStatus: "missing",
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.created",
      resourceType: "ActivityRecord",
      resourceId: record.id,
      metadata: {
        source: "supplier_data_request",
        supplierDataRequestId: requestId,
        supplierEmail: request.supplierEmail,
        categoryCode: request.categoryCode,
        quantity,
        unit,
      },
    });

    return NextResponse.json({ recordId: record.id }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
