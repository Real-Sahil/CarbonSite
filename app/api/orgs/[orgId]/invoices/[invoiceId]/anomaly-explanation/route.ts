export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion } from "@/lib/api/versioned-handler";
import { explainAnomaly } from "@/lib/explainability/forecast-explainer";

type Params = { params: Promise<{ orgId: string; invoiceId: string }> };

/**
 * GET /api/orgs/[orgId]/invoices/[invoiceId]/anomaly-explanation
 * Retrieve explainability for an invoice anomaly detection result
 * Shows why the invoice was flagged and with what confidence
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId, invoiceId } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    // Fetch the invoice record
    const invoice = await prisma.invoiceRecord.findFirst({
      where: {
        id: invoiceId,
        organizationId: orgId,
      },
      select: {
        id: true,
        totalAmount: true,
        vendorName: true,
        invoiceDate: true,
        receivedDate: true,
        sourceSystem: true,
      },
    });

    if (!invoice) {
      return apiError("NOT_FOUND", "Invoice not found", 404);
    }

    // Fetch associated anomaly detection results
    const anomalies = await prisma.invoiceAnomaly.findMany({
      where: {
        invoiceId: invoiceId,
      },
      orderBy: {
        severity: "desc",
      },
    });

    // Fetch historical invoices from the same vendor for baseline comparison
    const historicalInvoices = await prisma.invoiceRecord.findMany({
      where: {
        organizationId: orgId,
        vendorName: invoice.vendorName,
        id: { not: invoiceId },
      },
      select: {
        totalAmount: true,
        invoiceDate: true,
      },
      orderBy: {
        invoiceDate: "desc",
      },
      take: 50,
    });

    // Generate statistical explanation
    const explanation = explainAnomaly(
      parseFloat(String(invoice.totalAmount)),
      historicalInvoices.map((inv) => parseFloat(String(inv.totalAmount))),
      "combination"
    );

    // Enhance with specific anomaly details from detection results
    const anomalyDetails = anomalies.map((a) => ({
      type: a.anomalyType,
      severity: a.severity,
      reason: a.reason,
      detectedAt: a.detectedAt,
      resolution: a.resolution,
    }));

    return json(
      {
        invoiceId,
        vendor: invoice.vendorName,
        amount: parseFloat(String(invoice.totalAmount)),
        invoiceDate: invoice.invoiceDate,
        receivedDate: invoice.receivedDate,
        sourceSystem: invoice.sourceSystem,
        explanation: {
          summary: explanation.summary,
          isAnomaly: explanation.isAnomaly || anomalyDetails.length > 0,
          anomalyScore: Math.max(explanation.anomalyScore, anomalyDetails.length > 0 ? 0.5 : 0),
          primaryReasons: explanation.primaryReasons.map((r) => ({
            name: r.name,
            contribution: r.contribution,
            direction: r.direction,
            significance: r.significance,
            explanation: r.explanation,
          })),
          statisticalBasis: {
            zscore: explanation.statisticalBasis.zscore,
            baselineAmount: explanation.statisticalBasis.baselineValue,
            standardDeviation: explanation.statisticalBasis.baselineStdDev,
            outlierMultiplier: explanation.statisticalBasis.outlierMultiplier,
          },
          contextualFactors: explanation.contextualFactors,
          detectedAnomalies: anomalyDetails,
          vendorHistory: {
            totalInvoices: historicalInvoices.length,
            averageAmount: historicalInvoices.length > 0
              ? historicalInvoices.reduce((sum, inv) => sum + parseFloat(String(inv.totalAmount)), 0) / historicalInvoices.length
              : 0,
            recentInvoices: historicalInvoices.slice(0, 5).map((inv) => ({
              amount: parseFloat(String(inv.totalAmount)),
              date: inv.invoiceDate,
            })),
          },
        },
      },
      { version }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
