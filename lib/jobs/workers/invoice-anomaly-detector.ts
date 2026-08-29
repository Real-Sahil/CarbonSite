import { prisma } from "@/lib/db";
import { securityLogger } from "@/lib/logger";
import type { InvoiceRecord } from "@prisma/client";

interface LineItem {
  itemId: string;
  itemDescription?: string;
  quantityOrdered?: number;
  quantityReceived?: number | null;
  quantityInvoiced: number;
  unitPrice?: number;
  currency?: string;
}

interface DetectionRule {
  name: string;
  type: string;
  severity: "info" | "warning" | "critical";
  check: (invoice: InvoiceRecord, context: DetectionContext) => boolean;
  reason: (invoice: InvoiceRecord, context: DetectionContext) => string;
}

interface DetectionContext {
  maxHistoricalValue: number;
  recentInvoices: InvoiceRecord[];
  vendorBaselines: Map<string, number>;
}

// Rule 1: Detect duplicate invoices (same vendor + amount within 7 days)
const duplicateDetectionRule: DetectionRule = {
  name: "Duplicate Invoice Detection",
  type: "duplicate",
  severity: "critical",
  check: (invoice, context) => {
    const recentDuplicates = context.recentInvoices.filter(
      (inv) =>
        inv.vendorId === invoice.vendorId &&
        inv.totalAmount.toNumber() === invoice.totalAmount.toNumber() &&
        inv.id !== invoice.id &&
        Math.abs(
          invoice.invoiceDate.getTime() - inv.invoiceDate.getTime()
        ) < 7 * 24 * 60 * 60 * 1000
    );
    return recentDuplicates.length > 0;
  },
  reason: (invoice, context) => {
    const duplicates = context.recentInvoices.filter(
      (inv) =>
        inv.vendorId === invoice.vendorId &&
        inv.totalAmount.toNumber() === invoice.totalAmount.toNumber() &&
        inv.id !== invoice.id &&
        Math.abs(
          invoice.invoiceDate.getTime() - inv.invoiceDate.getTime()
        ) < 7 * 24 * 60 * 60 * 1000
    );
    return `Duplicate invoice detected: same vendor and amount as ${duplicates[0]?.externalInvoiceId || "unknown"}`;
  },
};

// Rule 2: Detect quantity mismatches (invoiced > received)
const quantityMismatchRule: DetectionRule = {
  name: "Quantity Mismatch Detection",
  type: "qty_mismatch",
  severity: "warning",
  check: (invoice) => {
    const lineItems = invoice.lineItems as LineItem[] | null;
    if (!lineItems || !Array.isArray(lineItems)) return false;

    return lineItems.some(
      (item) =>
        item.quantityInvoiced > (item.quantityReceived || 0) &&
        item.quantityReceived !== null
    );
  },
  reason: (invoice) => {
    const lineItems = invoice.lineItems as LineItem[] | null;
    if (!lineItems || !Array.isArray(lineItems)) {
      return "Quantity mismatch detected but line items not available";
    }
    const mismatchedItems = lineItems.filter(
      (item) =>
        item.quantityInvoiced > (item.quantityReceived || 0) &&
        item.quantityReceived !== null
    );
    const item = mismatchedItems[0];
    return `Over-billing detected: invoiced ${item?.quantityInvoiced} units but received ${item?.quantityReceived}`;
  },
};

// Rule 3: Detect date inconsistencies (invoice dated after goods receipt)
const dateInconsistencyRule: DetectionRule = {
  name: "Date Inconsistency Detection",
  type: "date_inconsistency",
  severity: "warning",
  check: (invoice) => {
    if (!invoice.receivedDate) return false;
    return invoice.invoiceDate > invoice.receivedDate;
  },
  reason: (invoice) => {
    return `Invoice dated after goods receipt: invoice ${invoice.invoiceDate.toISOString().split("T")[0]} vs received ${invoice.receivedDate?.toISOString().split("T")[0]}`;
  },
};

// Rule 4: Detect price spikes (20%+ above vendor baseline)
const priceSpikeRule: DetectionRule = {
  name: "Price Spike Detection",
  type: "price_spike",
  severity: "warning",
  check: (invoice, context) => {
    const baseline = context.vendorBaselines.get(invoice.vendorId);
    if (!baseline) return false; // Need historical data to detect spikes

    const percentChange =
      ((invoice.totalAmount.toNumber() - baseline) / baseline) * 100;
    return percentChange > 20;
  },
  reason: (invoice, context) => {
    const baseline = context.vendorBaselines.get(invoice.vendorId) || 0;
    const percentChange =
      ((invoice.totalAmount.toNumber() - baseline) / baseline) * 100;
    return `Price spike detected: ${percentChange.toFixed(1)}% above vendor baseline (GBP ${baseline.toFixed(2)})`;
  },
};

// Rule 5: Detect missing goods receipt notes (GRN)
const missingGrnRule: DetectionRule = {
  name: "Missing GRN Detection",
  type: "missing_grn",
  severity: "info",
  check: (invoice) => {
    return !invoice.receivedDate;
  },
  reason: () => {
    return "No goods receipt date recorded; invoice may not be matched to physical receipt";
  },
};

// Rule 6: Detect over-billing (invoiced > received by significant margin)
const overBillingRule: DetectionRule = {
  name: "Over-Billing Detection",
  type: "over_billing",
  severity: "critical",
  check: (invoice) => {
    const lineItems = invoice.lineItems as LineItem[] | null;
    if (!lineItems || !Array.isArray(lineItems)) return false;

    // Flag if ANY item is invoiced with ZERO received quantity (worst case)
    return lineItems.some(
      (item) => item.quantityInvoiced > 0 && (item.quantityReceived ?? 0) === 0
    );
  },
  reason: (invoice) => {
    const lineItems = invoice.lineItems as LineItem[] | null;
    if (!lineItems || !Array.isArray(lineItems)) {
      return "Over-billing detected but line items not available";
    }
    const zeroReceivedItems = lineItems.filter(
      (item) => item.quantityInvoiced > 0 && (item.quantityReceived ?? 0) === 0
    );
    const item = zeroReceivedItems[0];
    return `Invoiced items with zero receipt: ${item?.itemDescription || "unknown"} - ${item?.quantityInvoiced} units invoiced, 0 received`;
  },
};

// Rule 7: Detect currency mismatches (if applicable)
const currencyMismatchRule: DetectionRule = {
  name: "Currency Mismatch Detection",
  type: "currency_mismatch",
  severity: "warning",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  check: (invoice, _context) => {
    // Check if invoice currency differs from org default
    const invoiceData = invoice.lineItems as LineItem[] | null;
    return (
      invoiceData?.some((item) => item.currency && item.currency !== "GBP") ??
      false
    );
  },
  reason: (invoice) => {
    const invoiceData = invoice.lineItems as LineItem[] | null;
    if (!invoiceData || !Array.isArray(invoiceData)) {
      return "Currency mismatch detected but line items not available";
    }
    const currencyItem = invoiceData.find(
      (item) => item.currency && item.currency !== "GBP"
    );
    return `Currency mismatch: invoice in ${currencyItem?.currency || "unknown"}, org uses GBP`;
  },
};

// Rule 8: Detect unmatched invoices (high value with no corresponding records)
const unmatchedInvoiceRule: DetectionRule = {
  name: "Unmatched Invoice Detection",
  type: "unmatched_invoice",
  severity: "warning",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  check: (invoice, _context) => {
    // Flag as unmatched if no line items or reconciliation status is unmatched
    const lineItems = invoice.lineItems as LineItem[] | null;
    return (
      !lineItems ||
      lineItems.length === 0 ||
      invoice.scope3ReadyStatus === "rejected"
    );
  },
  reason: (invoice) => {
    return `Invoice not matched to purchase orders or goods receipts (status: ${invoice.scope3ReadyStatus})`;
  },
};

const DETECTION_RULES: DetectionRule[] = [
  duplicateDetectionRule,
  quantityMismatchRule,
  dateInconsistencyRule,
  priceSpikeRule,
  missingGrnRule,
  overBillingRule,
  currencyMismatchRule,
  unmatchedInvoiceRule,
];

export async function detectInvoiceAnomalies(
  orgId: string
): Promise<{ detectedCount: number; processedCount: number }> {
  securityLogger.info("Starting invoice anomaly detection", { orgId });

  try {
    // Fetch unprocessed invoices
    const unprocessedInvoices = await prisma.invoiceRecord.findMany({
      where: { organizationId: orgId, processedAt: null },
      take: 500,
    });

    if (unprocessedInvoices.length === 0) {
      securityLogger.info("No unprocessed invoices found", { orgId });
      return { detectedCount: 0, processedCount: 0 };
    }

    // Build detection context
    const recentInvoices = await prisma.invoiceRecord.findMany({
      where: {
        organizationId: orgId,
        invoiceDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    // Build vendor baselines (average amount per vendor)
    const vendorBaselines = new Map<string, number>();
    for (const vendor of new Set(
      recentInvoices.map((inv) => inv.vendorId)
    )) {
      const vendorInvoices = recentInvoices.filter(
        (inv) => inv.vendorId === vendor
      );
      const avgAmount =
        vendorInvoices.reduce((sum, inv) => sum + inv.totalAmount.toNumber(), 0) /
        vendorInvoices.length;
      vendorBaselines.set(vendor, avgAmount);
    }

    // Get max historical value for org
    const maxHistoricalRow = await prisma.invoiceRecord.aggregate({
      where: { organizationId: orgId },
      _max: { totalAmount: true },
    });
    const maxHistoricalValue = maxHistoricalRow._max.totalAmount?.toNumber() ?? 0;

    const context: DetectionContext = {
      maxHistoricalValue,
      recentInvoices,
      vendorBaselines,
    };

    let anomalyCount = 0;

    // Run all detection rules on each invoice
    for (const invoice of unprocessedInvoices) {
      const detectedAnomalies = DETECTION_RULES.filter((rule) =>
        rule.check(invoice, context)
      );

      // Create anomaly records
      for (const rule of detectedAnomalies) {
        await prisma.invoiceAnomaly.create({
          data: {
            organizationId: orgId,
            invoiceId: invoice.id,
            anomalyType: rule.type,
            severity: rule.severity,
            reason: rule.reason(invoice, context),
          },
        });
        anomalyCount++;
      }

      // Mark invoice as processed
      await prisma.invoiceRecord.update({
        where: { id: invoice.id },
        data: { processedAt: new Date() },
      });
    }

    securityLogger.info("Invoice anomaly detection complete", {
      orgId,
      processedCount: unprocessedInvoices.length,
      detectedCount: anomalyCount,
      avgAnomaliesPerInvoice: (
        anomalyCount / unprocessedInvoices.length
      ).toFixed(2),
    });

    return {
      detectedCount: anomalyCount,
      processedCount: unprocessedInvoices.length,
    };
  } catch (error) {
    securityLogger.error("Error during invoice anomaly detection", {
      orgId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function getInvoiceAnomalies(
  orgId: string,
  filters?: {
    severity?: "info" | "warning" | "critical";
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const where: Record<string, unknown> = {
    invoice: { organizationId: orgId },
  };

  if (filters?.severity) {
    where.severity = filters.severity;
  }
  if (filters?.type) {
    where.anomalyType = filters.type;
  }
  if (filters?.status) {
    where.resolution = filters.status;
  }
  if (filters?.startDate || filters?.endDate) {
    const detectedAtFilter: Record<string, Date> = {};
    if (filters?.startDate) {
      detectedAtFilter.gte = filters.startDate;
    }
    if (filters?.endDate) {
      detectedAtFilter.lte = filters.endDate;
    }
    where.detectedAt = detectedAtFilter;
  }

  return prisma.invoiceAnomaly.findMany({
    where,
    include: { invoice: true },
    orderBy: { detectedAt: "desc" },
  });
}

export async function resolveInvoiceAnomaly(
  anomalyId: string,
  resolution: string,
  notes?: string,
  resolvedByUserId?: string
) {
  return prisma.invoiceAnomaly.update({
    where: { id: anomalyId },
    data: {
      resolution,
      notes,
      resolvedBy: resolvedByUserId,
      resolvedAt: new Date(),
    },
  });
}
