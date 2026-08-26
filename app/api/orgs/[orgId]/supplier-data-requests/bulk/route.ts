export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { sendEmail, supplierDataRequestEmail } from "@/lib/notifications/email";
import { parseBulkSupplierCSV } from "@/lib/suppliers/bulk-parser";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonsite-rosy.vercel.app";
const EXPIRES_DAYS = 30;

const bulkUploadSchema = z.object({
  csvContent: z.string().min(10),
  reportingPeriodId: z.string().min(1),
  categoryCode: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

// POST /api/orgs/[orgId]/supplier-data-requests/bulk — upload CSV and create requests
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = bulkUploadSchema.parse(await req.json());

    // Parse CSV
    const parseResult = parseBulkSupplierCSV(body.csvContent);

    // Check if parsing had errors
    if (parseResult.errors.length > 0 && parseResult.valid.length === 0) {
      return NextResponse.json(
        {
          code: "INVALID_CSV",
          message: "CSV parsing failed.",
          errors: parseResult.errors.slice(0, 10), // Return first 10 errors
        },
        { status: 422 },
      );
    }

    // Verify period exists
    const period = await prisma.reportingPeriod.findFirst({
      where: { id: body.reportingPeriodId, organizationId: orgId },
      select: { id: true, label: true },
    });

    if (!period) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Reporting period not found." },
        { status: 404 },
      );
    }

    // Fetch org for email
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    const created: string[] = [];
    const failed: Array<{ email: string; reason: string }> = [];

    // Create requests for each supplier
    for (const supplier of parseResult.valid) {
      try {
        // Check if supplier already has active request for this period/category
        const existing = await prisma.supplierDataRequest.findFirst({
          where: {
            organizationId: orgId,
            reportingPeriodId: period.id,
            supplierEmail: supplier.email,
            categoryCode: body.categoryCode,
            status: { not: "expired" },
          },
        });

        if (existing) {
          failed.push({
            email: supplier.email,
            reason: "Already has active request for this category and period",
          });
          continue;
        }

        const request = await prisma.supplierDataRequest.create({
          data: {
            organizationId: orgId,
            reportingPeriodId: period.id,
            supplierEmail: supplier.email,
            supplierName: supplier.name ?? null,
            categoryCode: body.categoryCode,
            expiresAt,
            notes: body.notes ?? null,
            createdByUserId: session.user.id,
          },
        });

        const formUrl = `${APP_URL}/supplier-data/${request.token}`;

        // Send email
        await sendEmail({
          to: supplier.email,
          ...supplierDataRequestEmail({
            recipientName: supplier.name ?? supplier.email,
            orgName: org?.name ?? "a customer",
            categoryName: body.categoryCode.replace(/^s\d-/, "").replace(/-/g, " "),
            periodLabel: period.label,
            formUrl,
            expiresAt,
          }),
        });

        created.push(supplier.email);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Unknown error";
        failed.push({
          email: supplier.email,
          reason,
        });
      }
    }

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "supplier_data_request.sent",
      resourceType: "SupplierDataRequest",
      resourceId: body.reportingPeriodId,
      metadata: {
        categoryCode: body.categoryCode,
        bulkUpload: true,
        totalSent: created.length,
        totalFailed: failed.length,
        totalParsedErrors: parseResult.errors.length,
        sentTo: created,
      },
    });

    return NextResponse.json(
      {
        sent: created.length,
        failed: failed.length,
        parseErrors: parseResult.errors.length,
        sentTo: created,
        failedEmails: failed,
        parseErrorSummary: parseResult.errors.slice(0, 5), // First 5 parse errors
        message: `Bulk upload complete: ${created.length} requests sent, ${failed.length} failed, ${parseResult.errors.length} parse errors`,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
