export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

type Params = { params: Promise<{ orgId: string; reportId: string }> };

const ReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), reportingPeriodId: z.string().min(1) }),
  z.object({ action: z.literal("reject"), rejectionReason: z.string().min(1).max(500) }),
  z.object({ action: z.literal("under_review") }),
]);

// PATCH /api/orgs/[orgId]/supplier-reports/[reportId] — accept or reject a supplier report
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const body = await req.json();
    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Invalid action", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const report = await prisma.supplierReport.findUnique({
      where: { id: reportId, organizationId: orgId },
      select: {
        id: true,
        status: true,
        supplierEmail: true,
        supplierName: true,
        emissionCategoryId: true,
        reportingYear: true,
        totalAmount: true,
        unit: true,
        calculationMethod: true,
        notes: true,
        supplierDataRequestId: true,
      },
    });

    if (!report) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Report not found" }, { status: 404 });
    }

    if (report.status === "accepted" || report.status === "rejected") {
      return NextResponse.json(
        { code: "ALREADY_REVIEWED", message: `This report has already been ${report.status}.` },
        { status: 409 }
      );
    }

    const reviewerId = session.user.id;
    const now = new Date();

    if (parsed.data.action === "under_review") {
      await prisma.supplierReport.update({
        where: { id: reportId },
        data: { status: "under_review" },
      });
      return NextResponse.json({ status: "under_review" });
    }

    if (parsed.data.action === "reject") {
      await prisma.supplierReport.update({
        where: { id: reportId },
        data: {
          status: "rejected",
          reviewedByUserId: reviewerId,
          reviewedAt: now,
          rejectionReason: parsed.data.rejectionReason,
        },
      });

      // Mark the originating data request as rejected if linked
      if (report.supplierDataRequestId) {
        await prisma.supplierDataRequest.update({
          where: { id: report.supplierDataRequestId },
          data: { status: "rejected", reviewedAt: now, rejectionReason: parsed.data.rejectionReason },
        });
      }

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: reviewerId,
        action: "supplier_report.rejected",
        resourceType: "SupplierReport",
        resourceId: reportId,
        metadata: { supplierEmail: report.supplierEmail, rejectionReason: parsed.data.rejectionReason },
      });

      return NextResponse.json({ status: "rejected" });
    }

    // action === "accept" — convert to ActivityRecord
    const { reportingPeriodId } = parsed.data;

    // Verify reporting period belongs to org
    const period = await prisma.reportingPeriod.findUnique({
      where: { id: reportingPeriodId, organizationId: orgId },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!period) {
      return NextResponse.json(
        { code: "INVALID_PERIOD", message: "Reporting period not found for this organisation." },
        { status: 400 }
      );
    }

    // Determine spend vs. emission unit
    const currencyUnits = ["GBP", "USD", "EUR"];
    const isCurrencyUnit = currencyUnits.includes(report.unit);

    const activityRecord = await prisma.$transaction(async (tx) => {
      const record = await tx.activityRecord.create({
        data: {
          organizationId: orgId,
          reportingPeriodId,
          emissionCategoryId: report.emissionCategoryId,
          amount: isCurrencyUnit ? 0 : report.totalAmount, // spend-based: amount 0, spendAmount holds value
          unit: isCurrencyUnit ? "tCO2e" : report.unit,
          spendAmount: isCurrencyUnit ? report.totalAmount : null,
          spendCurrency: isCurrencyUnit ? report.unit : null,
          supplierName: report.supplierName ?? report.supplierEmail,
          sourceDescription: `Supplier report: ${report.supplierEmail} (${report.calculationMethod})`,
          assumptionNotes: report.notes,
          reviewStatus: "approved",
          evidenceStatus: "missing",
          createdByUserId: reviewerId,
          activityDate: period.startDate,
        },
      });

      await tx.supplierReport.update({
        where: { id: reportId },
        data: {
          status: "accepted",
          reviewedByUserId: reviewerId,
          reviewedAt: now,
          convertedToRecordId: record.id,
          convertedAt: now,
        },
      });

      // Mark originating data request as converted
      if (report.supplierDataRequestId) {
        await tx.supplierDataRequest.update({
          where: { id: report.supplierDataRequestId },
          data: { status: "converted", reviewedAt: now, approvedByUserId: reviewerId },
        });
      }

      return record;
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: reviewerId,
      action: "supplier_report.accepted",
      resourceType: "SupplierReport",
      resourceId: reportId,
      metadata: {
        supplierEmail: report.supplierEmail,
        activityRecordId: activityRecord.id,
        reportingPeriodId,
      },
    });

    return NextResponse.json({
      status: "accepted",
      activityRecordId: activityRecord.id,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// GET /api/orgs/[orgId]/supplier-reports/[reportId] — fetch single report detail
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "auditor");

    const report = await prisma.supplierReport.findUnique({
      where: { id: reportId, organizationId: orgId },
      select: {
        id: true,
        supplierEmail: true,
        supplierName: true,
        supplierDomain: true,
        reportingYear: true,
        totalAmount: true,
        unit: true,
        calculationMethod: true,
        notes: true,
        supportingFileKeys: true,
        qualityScore: true,
        qualityFlags: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        rejectionReason: true,
        convertedToRecordId: true,
        convertedAt: true,
        emissionCategory: { select: { code: true, name: true, scope: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!report) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Report not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (err) {
    return handleRouteError(err);
  }
}
