export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { hashToken } from "@/lib/management-systems/auditor-access";

type Params = { params: Promise<{ token: string }> };

const SubmissionSchema = z.object({
  totalAmount: z.number().positive("Amount must be greater than 0"),
  unit: z.enum(["tonnes", "kg", "GBP", "USD", "EUR"]),
  calculationMethod: z.enum(["direct", "estimate", "audit", "model"]),
  notes: z.string().max(1000).optional(),
  emissionCategoryId: z.string().min(1), // categoryCode sent by client
  reportingYear: z.number().int().min(2000).max(2100),
});

// Closed requests take no second report; rejected is closed here as in the validate route. flagged stays open.
const CLOSED_STATUSES = ["submitted", "approved", "converted", "rejected"];

// POST /api/public/supplier-data/[token]/submit — submit supplier emissions data
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimitRequest(req, { key: "public-supplier-data-submit", limit: 20, windowMs: 15 * 60_000 });
    if (limited) return limited;
    const { token } = await params;
    const body = await req.json();

    const parsed = SubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid submission data",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const dataRequest = await prisma.supplierDataRequest.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        organizationId: true,
        supplierEmail: true,
        categoryCode: true,
        reportingPeriod: { select: { startDate: true } },
        expiresAt: true,
        status: true,
      },
    });

    if (!dataRequest) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Data request not found" },
        { status: 404 }
      );
    }

    if (dataRequest.expiresAt && new Date(dataRequest.expiresAt) < new Date()) {
      return NextResponse.json(
        { code: "EXPIRED", message: "This data request has expired" },
        { status: 410 }
      );
    }

    if (CLOSED_STATUSES.includes(dataRequest.status)) {
      return NextResponse.json(
        {
          code: "ALREADY_PROCESSED",
          message: `This data request has already been ${dataRequest.status}`,
        },
        { status: 409 }
      );
    }

    // Verify category code matches the data request
    if (parsed.data.emissionCategoryId !== dataRequest.categoryCode) {
      return NextResponse.json(
        { code: "CATEGORY_MISMATCH", message: "Category does not match data request" },
        { status: 400 }
      );
    }

    // Verify reporting year matches the data request
    const requestedYear = dataRequest.reportingPeriod.startDate.getFullYear();
    if (parsed.data.reportingYear !== requestedYear) {
      return NextResponse.json(
        { code: "YEAR_MISMATCH", message: `Reporting year must be ${requestedYear}` },
        { status: 400 }
      );
    }

    const category = await prisma.emissionCategory.findUnique({
      where: { code: dataRequest.categoryCode },
    });

    if (!category) {
      return NextResponse.json(
        { code: "INVALID_CATEGORY", message: "Emission category not found" },
        { status: 400 }
      );
    }

    const supplierName = dataRequest.supplierEmail.split("@")[0];
    const qualityScore = calculateQualityScore(parsed.data);
    const qualityFlags = identifyQualityFlags(parsed.data);

    // Serializable: a POST racing this one fails its request update (P2034), so only one report is written.
    const report = await prisma.$transaction(async (tx) => {
      // Re-read in the transaction: a POST that committed after the check above must not write a second report.
      const current = await tx.supplierDataRequest.findUnique({
        where: { tokenHash: hashToken(token) },
        select: { status: true },
      });
      if (!current || CLOSED_STATUSES.includes(current.status)) return null;

      const report = await tx.supplierReport.create({
        data: {
          organizationId: dataRequest.organizationId,
          supplierEmail: dataRequest.supplierEmail,
          supplierName,
          emissionCategoryId: category.id,
          reportingYear: parsed.data.reportingYear,
          totalAmount: parsed.data.totalAmount,
          unit: parsed.data.unit,
          calculationMethod: parsed.data.calculationMethod,
          notes: parsed.data.notes || null,
          qualityScore,
          qualityFlags: qualityFlags.length > 0 ? qualityFlags : undefined,
          status: "submitted",
          submittedAt: new Date(),
          supplierDataRequestId: dataRequest.id,
        },
      });

      await tx.supplierDataRequest.update({
        where: { id: dataRequest.id },
        data: {
          status: "submitted",
          submittedAt: new Date(),
        },
      });

      return report;
    }, { isolationLevel: "Serializable" });

    if (!report) {
      return apiError("ALREADY_PROCESSED", "This data request has already been processed", 409);
    }

    return NextResponse.json(
      {
        id: report.id,
        message: "Data submitted successfully",
        status: "submitted",
      },
      { status: 201 }
    );
  } catch (err) {
    // A racing POST that commits first fails this one's Serializable transaction with P2034: a duplicate, not a fault.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2034") {
      return apiError("ALREADY_PROCESSED", "This data request has already been processed", 409);
    }
    return handleRouteError(err);
  }
}

function calculateQualityScore(data: z.infer<typeof SubmissionSchema>): number {
  let score = 100;

  if (!data.notes || data.notes.trim().length === 0) {
    score -= 20;
  } else if (data.notes.length < 50) {
    score -= 10;
  }

  if (data.calculationMethod === "estimate") {
    score -= 15;
  }

  if (data.unit === "GBP" || data.unit === "USD" || data.unit === "EUR") {
    score -= 5;
  }

  return Math.max(score, 30);
}

function identifyQualityFlags(data: z.infer<typeof SubmissionSchema>): string[] {
  const flags: string[] = [];

  if (!data.notes || data.notes.trim().length === 0) {
    flags.push("No supporting notes provided");
  }

  if (data.calculationMethod === "estimate") {
    flags.push("Estimated calculation method (not direct measurement)");
  }

  if (
    data.totalAmount > 1000000 ||
    (data.unit === "tonnes" && data.totalAmount > 100000)
  ) {
    flags.push("Unusually high emission value");
  }

  if (data.unit === "GBP" || data.unit === "USD" || data.unit === "EUR") {
    flags.push("Spend-based data (not actual measurement)");
  }

  return flags;
}
