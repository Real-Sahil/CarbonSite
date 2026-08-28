import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/db";
import { detectInvoiceAnomalies } from "../invoice-anomaly-detector";
import type { InvoiceRecord } from "@prisma/client";

interface LineItem {
  itemId: string;
  itemDescription?: string;
  quantityOrdered?: number;
  quantityReceived?: number;
  quantityInvoiced: number;
  unitPrice?: number;
}

// Helper to create test invoice records
async function createTestInvoice(
  orgId: string,
  overrides: Partial<{
    externalInvoiceId: string;
    sourceSystem: string;
    vendorId: string;
    vendorName: string;
    invoiceDate: Date;
    receivedDate: Date | null;
    totalAmount: number | Decimal;
    lineItems: LineItem[] | null;
    scope3ReadyStatus: string;
    extractedAt: Date;
    processedAt: Date | null;
  }> = {}
): Promise<InvoiceRecord> {
  return prisma.invoiceRecord.create({
    data: {
      organizationId: orgId,
      externalInvoiceId: overrides.externalInvoiceId || `INV-${Math.random().toString(36).substr(2, 9)}`,
      sourceSystem: overrides.sourceSystem || "xero",
      vendorId: overrides.vendorId || `vendor-${Math.random().toString(36).substr(2, 9)}`,
      vendorName: overrides.vendorName || "Test Vendor",
      invoiceDate: overrides.invoiceDate || new Date(),
      receivedDate: overrides.receivedDate !== undefined ? overrides.receivedDate : null,
      totalAmount: overrides.totalAmount ? new Decimal(overrides.totalAmount) : new Decimal(1000),
      lineItems: overrides.lineItems ? JSON.parse(JSON.stringify(overrides.lineItems)) : null,
      scope3ReadyStatus: overrides.scope3ReadyStatus || "rejected",
      extractedAt: overrides.extractedAt || new Date(),
      processedAt: overrides.processedAt || null,
    },
  });
}

describe.skip("Invoice Anomaly Detector", () => {
  let testOrgId: string;

  beforeEach(async () => {
    // Create a test organization for each test
    const org = await prisma.organization.create({
      data: {
        name: `Test Org ${Date.now()}`,
      },
    });
    testOrgId = org.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.invoiceAnomaly.deleteMany({
      where: { invoice: { organizationId: testOrgId } },
    });
    await prisma.invoiceRecord.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({
      where: { id: testOrgId },
    });
  });

  describe("Duplicate Detection", () => {
    it("should detect duplicate invoices (same vendor + amount within 7 days)", async () => {
      const vendorId = "vendor-1";
      const baseDate = new Date();

      // Create two identical invoices within 7 days
      const inv1 = await createTestInvoice(testOrgId, {
        vendorId,
        vendorName: "ACME Corp",
        totalAmount: new Decimal(5000),
        invoiceDate: baseDate,
      });

      const inv2 = await createTestInvoice(testOrgId, {
        vendorId,
        vendorName: "ACME Corp",
        totalAmount: new Decimal(5000),
        invoiceDate: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days later
      });

      const result = await detectInvoiceAnomalies(testOrgId);
      expect(result.detectedCount).toBeGreaterThan(0);

      const anomalies = await prisma.invoiceAnomaly.findMany({
        where: { anomalyType: "duplicate" },
      });
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some((a) => a.invoiceId === inv2.id)).toBe(true);
    });

    it("should not flag as duplicate if invoices are >7 days apart", async () => {
      const vendorId = "vendor-2";
      const baseDate = new Date();

      await createTestInvoice(testOrgId, {
        vendorId,
        vendorName: "Test Vendor",
        totalAmount: new Decimal(5000),
        invoiceDate: baseDate,
      });

      await createTestInvoice(testOrgId, {
        vendorId,
        vendorName: "Test Vendor",
        totalAmount: new Decimal(5000),
        invoiceDate: new Date(baseDate.getTime() + 8 * 24 * 60 * 60 * 1000), // 8 days later
      });

      const result = await detectInvoiceAnomalies(testOrgId);
      const duplicateAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "duplicate",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(duplicateAnomalies.length).toBe(0);
    });
  });

  describe("Quantity Mismatch Detection", () => {
    it("should detect when invoiced quantity > received quantity", async () => {
      const lineItems = [
        {
          itemId: "item-1",
          itemDescription: "Widget A",
          quantityOrdered: 100,
          quantityReceived: 80,
          quantityInvoiced: 100,
        },
      ];

      await createTestInvoice(testOrgId, {
        lineItems: lineItems as any,
      });

      const result = await detectInvoiceAnomalies(testOrgId);
      expect(result.detectedCount).toBeGreaterThan(0);

      const anomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "qty_mismatch",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(anomalies.length).toBeGreaterThan(0);
    });

    it("should not flag quantity mismatch if received equals invoiced", async () => {
      const lineItems = [
        {
          itemId: "item-1",
          quantityReceived: 100,
          quantityInvoiced: 100,
        },
      ];

      await createTestInvoice(testOrgId, {
        lineItems: lineItems as any,
      });

      const result = await detectInvoiceAnomalies(testOrgId);
      const qtyAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "qty_mismatch",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(qtyAnomalies.length).toBe(0);
    });
  });

  describe("Date Inconsistency Detection", () => {
    it("should flag when invoice date is after received date", async () => {
      const receivedDate = new Date("2024-01-15");
      const invoiceDate = new Date("2024-01-20"); // 5 days after receipt

      await createTestInvoice(testOrgId, {
        invoiceDate,
        receivedDate,
      });

      const result = await detectInvoiceAnomalies(testOrgId);
      const dateAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "date_inconsistency",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(dateAnomalies.length).toBeGreaterThan(0);
    });

    it("should not flag if receipt date is after invoice date", async () => {
      const invoiceDate = new Date("2024-01-15");
      const receivedDate = new Date("2024-01-20");

      await createTestInvoice(testOrgId, {
        invoiceDate,
        receivedDate,
      });

      const dateAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "date_inconsistency",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(dateAnomalies.length).toBe(0);
    });
  });

  describe("Price Spike Detection", () => {
    it("should detect 20%+ price increase above vendor baseline", async () => {
      const vendorId = "vendor-price-test";

      // Create baseline invoices
      for (let i = 0; i < 3; i++) {
        await createTestInvoice(testOrgId, {
          vendorId,
          vendorName: "Price Test Vendor",
          totalAmount: new Decimal(1000),
          invoiceDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        });
      }

      // Create spike invoice (25% above baseline)
      await createTestInvoice(testOrgId, {
        vendorId,
        vendorName: "Price Test Vendor",
        totalAmount: new Decimal(1250),
        invoiceDate: new Date(),
      });

      const result = await detectInvoiceAnomalies(testOrgId);
      const priceAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "price_spike",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(priceAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe("Missing GRN Detection", () => {
    it("should flag invoices with no received date", async () => {
      await createTestInvoice(testOrgId, {
        receivedDate: null,
      });

      const result = await detectInvoiceAnomalies(testOrgId);
      const grnAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "missing_grn",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(grnAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe("Over-Billing Detection", () => {
    it("should detect when items invoiced but zero received", async () => {
      const lineItems = [
        {
          itemId: "item-1",
          itemDescription: "Service",
          quantityInvoiced: 50,
          quantityReceived: 0,
        },
      ];

      await createTestInvoice(testOrgId, {
        lineItems: lineItems as any,
      });

      const result = await detectInvoiceAnomalies(testOrgId);
      const overBillingAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "over_billing",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(overBillingAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe("Unmatched Invoice Detection", () => {
    it("should flag invoices with no line items", async () => {
      await createTestInvoice(testOrgId, {
        lineItems: null,
        scope3ReadyStatus: "pending",
      });

      const result = await detectInvoiceAnomalies(testOrgId);
      const unmatchedAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "unmatched_invoice",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(unmatchedAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe("Full Detection Pipeline", () => {
    it("should process all unprocessed invoices and mark them processed", async () => {
      // Create multiple test invoices
      const inv1 = await createTestInvoice(testOrgId, { processedAt: null });
      const inv2 = await createTestInvoice(testOrgId, { processedAt: null });
      const inv3 = await createTestInvoice(testOrgId, { processedAt: new Date() });

      const result = await detectInvoiceAnomalies(testOrgId);
      expect(result.processedCount).toBeGreaterThanOrEqual(2);

      // Check that previously unprocessed are now processed
      const processedInv1 = await prisma.invoiceRecord.findUnique({
        where: { id: inv1.id },
      });
      expect(processedInv1?.processedAt).not.toBeNull();

      const processedInv2 = await prisma.invoiceRecord.findUnique({
        where: { id: inv2.id },
      });
      expect(processedInv2?.processedAt).not.toBeNull();

      // Check that already processed invoice remains unchanged
      const processedInv3 = await prisma.invoiceRecord.findUnique({
        where: { id: inv3.id },
      });
      expect(processedInv3?.processedAt).not.toBeNull();
    });

    it("should handle empty invoice batch gracefully", async () => {
      const result = await detectInvoiceAnomalies(testOrgId);
      expect(result.processedCount).toBe(0);
      expect(result.detectedCount).toBe(0);
    });
  });

  describe("Severity Classification", () => {
    it("should assign CRITICAL severity to duplicate and over-billing anomalies", async () => {
      const vendorId = "critical-test-vendor";
      const baseDate = new Date();

      // Create duplicate
      await createTestInvoice(testOrgId, {
        vendorId,
        totalAmount: new Decimal(5000),
        invoiceDate: baseDate,
      });
      await createTestInvoice(testOrgId, {
        vendorId,
        totalAmount: new Decimal(5000),
        invoiceDate: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      });

      await detectInvoiceAnomalies(testOrgId);

      const criticalAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          severity: "critical",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(criticalAnomalies.length).toBeGreaterThan(0);
    });

    it("should assign WARNING severity to date and qty mismatches", async () => {
      const lineItems = [
        {
          itemId: "item-1",
          quantityReceived: 80,
          quantityInvoiced: 100,
        },
      ];

      await createTestInvoice(testOrgId, {
        invoiceDate: new Date("2024-01-20"),
        receivedDate: new Date("2024-01-15"),
        lineItems: lineItems as any,
      });

      await detectInvoiceAnomalies(testOrgId);

      const warningAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          severity: "warning",
          invoice: { organizationId: testOrgId },
        },
      });
      expect(warningAnomalies.length).toBeGreaterThan(0);
    });
  });
});
