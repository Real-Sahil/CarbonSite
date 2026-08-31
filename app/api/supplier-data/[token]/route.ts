export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ token: string }> };

const SubmitSchema = z.object({
  totalAmount: z.number().positive("Amount must be positive"),
  unit: z.enum(["tCO2e", "kgCO2e", "GBP", "USD", "EUR"]),
  calculationMethod: z.enum(["spend_based", "activity_based", "direct_measurement"]),
  notes: z.string().max(2000).optional(),
  // Optional supplier name correction (pre-populated from request but editable)
  supplierName: z.string().max(200).optional(),
});

// POST /api/supplier-data/[token] — anonymous supplier Scope 3 form submission
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const body = await req.json();
    const parsed = SubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Invalid submission", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { totalAmount, unit, calculationMethod, notes, supplierName } = parsed.data;

    // Load the request and validate token
    const request = await prisma.supplierDataRequest.findUnique({
      where: { token },
      select: {
        id: true,
        organizationId: true,
        reportingPeriodId: true,
        supplierEmail: true,
        supplierName: true,
        categoryCode: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!request) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "This data request link is not valid." },
        { status: 404 }
      );
    }

    if (request.expiresAt <= new Date()) {
      return NextResponse.json(
        { code: "EXPIRED", message: "This data request link has expired. Contact the organisation that sent it." },
        { status: 410 }
      );
    }

    if (request.status === "converted") {
      return NextResponse.json(
        { code: "ALREADY_SUBMITTED", message: "This data request has already been submitted and accepted." },
        { status: 409 }
      );
    }

    // Resolve the emission category from the category code
    const category = await prisma.emissionCategory.findUnique({
      where: { code: request.categoryCode },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.json(
        { code: "CATEGORY_NOT_FOUND", message: `Unknown emission category: ${request.categoryCode}` },
        { status: 400 }
      );
    }

    // Resolve the reporting year from the reporting period
    const period = await prisma.reportingPeriod.findUnique({
      where: { id: request.reportingPeriodId },
      select: { startDate: true },
    });

    const reportingYear = period ? period.startDate.getFullYear() : new Date().getFullYear();

    // Run basic quality checks
    const qualityFlags: Array<{ type: string; message: string; severity: "info" | "warning" | "error" }> = [];

    if (unit === "kgCO2e" && totalAmount > 1_000_000) {
      qualityFlags.push({
        type: "large_value",
        message: `${totalAmount.toLocaleString()} kgCO2e is unusually large. Did you mean ${(totalAmount / 1000).toLocaleString()} tCO2e?`,
        severity: "warning",
      });
    }

    if (calculationMethod === "spend_based" && !["GBP", "USD", "EUR"].includes(unit)) {
      qualityFlags.push({
        type: "unit_method_mismatch",
        message: "Spend-based calculation method typically uses a currency unit (GBP, USD, EUR).",
        severity: "warning",
      });
    }

    if (!notes && calculationMethod === "activity_based") {
      qualityFlags.push({
        type: "missing_notes",
        message: "Activity-based submissions benefit from a description of what data was used.",
        severity: "info",
      });
    }

    const qualityScore = Math.max(0, 100 - qualityFlags.filter((f) => f.severity === "error").length * 40 - qualityFlags.filter((f) => f.severity === "warning").length * 15);

    // Extract domain from email for supplier grouping
    const supplierDomain = request.supplierEmail.split("@")[1] ?? null;

    // Create the SupplierReport
    const report = await prisma.supplierReport.create({
      data: {
        organizationId: request.organizationId,
        supplierDataRequestId: request.id,
        supplierEmail: request.supplierEmail,
        supplierName: supplierName ?? request.supplierName,
        supplierDomain,
        emissionCategoryId: category.id,
        reportingYear,
        totalAmount,
        unit,
        calculationMethod,
        notes,
        supportingFileKeys: [],
        qualityScore,
        qualityFlags: qualityFlags.length > 0 ? qualityFlags : undefined,
        status: "submitted",
      },
    });

    // Mark the data request as submitted
    await prisma.supplierDataRequest.update({
      where: { id: request.id },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        submittedData: { supplierReportId: report.id },
      },
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      qualityScore,
      qualityFlags,
      message: "Your data has been submitted successfully. The organisation will review it shortly.",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// GET /api/supplier-data/[token] — prefill data for the form (token validation + request metadata)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const request = await prisma.supplierDataRequest.findUnique({
      where: { token },
      select: {
        supplierEmail: true,
        supplierName: true,
        categoryCode: true,
        status: true,
        expiresAt: true,
        organization: { select: { name: true } },
        reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
      },
    });

    if (!request) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "This data request link is not valid." },
        { status: 404 }
      );
    }

    if (request.expiresAt <= new Date()) {
      return NextResponse.json(
        { code: "EXPIRED", message: "This data request link has expired." },
        { status: 410 }
      );
    }

    return NextResponse.json({
      supplierEmail: request.supplierEmail,
      supplierName: request.supplierName,
      categoryCode: request.categoryCode,
      organizationName: request.organization.name,
      reportingPeriod: request.reportingPeriod,
      status: request.status,
      alreadySubmitted: request.status === "submitted" || request.status === "converted",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
