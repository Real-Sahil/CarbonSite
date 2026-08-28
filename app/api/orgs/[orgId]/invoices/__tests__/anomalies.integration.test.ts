import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { detectInvoiceAnomalies } from "@/lib/jobs/workers/invoice-anomaly-detector";
import { Decimal } from "@prisma/client/runtime/library";

describe.skip("Invoice Anomaly Detection - Integration", () => {
  let testOrgId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({
      data: {
        name: `Test Org ${Date.now()}`,
      },
    });
    testOrgId = org.id;
  });

  afterEach(async () => {
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
    it("should detect and flag duplicate invoices", async () => {
      const vendorId = "vendor-duplicate-test";
      const baseDate = new Date("2024-01-15");

      await prisma.invoiceRecord.createMany({
        data: [
          {
            organizationId: testOrgId,
            externalInvoiceId: "INV-001",
            sourceSystem: "xero",
            vendorId,
            vendorName: "ACME Corp",
            invoiceDate: baseDate,
            receivedDate: new Date("2024-01-14"),
            totalAmount: new Decimal("5000.00"),
            lineItems: undefined,
            reconciliationStatus: "matched",
            processed: false,
          },
          {
            organizationId: testOrgId,
            externalInvoiceId: "INV-002",
            sourceSystem: "xero",
            vendorId,
            vendorName: "ACME Corp",
            invoiceDate: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days later
            receivedDate: new Date("2024-01-17"),
            totalAmount: new Decimal("5000.00"),
            lineItems: undefined,
            reconciliationStatus: "matched",
            processed: false,
          },
        ],
      });

      const result = await detectInvoiceAnomalies(testOrgId);

      expect(result.processedCount).toBeGreaterThanOrEqual(2);
      expect(result.detectedCount).toBeGreaterThan(0);

      const duplicateAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "duplicate",
          invoice: { organizationId: testOrgId },
        },
      });

      expect(duplicateAnomalies.length).toBeGreaterThan(0);
      expect(duplicateAnomalies.some((a) => a.severity === "critical")).toBe(true);
    });
  });

  describe("Quantity Mismatch Detection", () => {
    it("should detect when invoiced > received", async () => {
      const lineItems = [
        {
          itemId: "item-1",
          itemDescription: "Waste Disposal",
          quantityOrdered: 100,
          quantityReceived: 80,
          quantityInvoiced: 100,
          unitPrice: 50,
        },
      ];

      await prisma.invoiceRecord.create({
        data: {
          organizationId: testOrgId,
          externalInvoiceId: "INV-QTY-001",
          sourceSystem: "xero",
          vendorId: "vendor-qty",
          vendorName: "Test Vendor",
          invoiceDate: new Date(),
          receivedDate: new Date(),
          totalAmount: new Decimal("5000.00"),
          lineItems: lineItems as any,
          reconciliationStatus: "unmatched",
          processed: false,
        },
      });

      const result = await detectInvoiceAnomalies(testOrgId);

      expect(result.detectedCount).toBeGreaterThan(0);

      const qtyMismatchAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "qty_mismatch",
          invoice: { organizationId: testOrgId },
        },
      });

      expect(qtyMismatchAnomalies.length).toBeGreaterThan(0);
      expect(qtyMismatchAnomalies[0].severity).toBe("warning");
    });
  });

  describe("Date Inconsistency Detection", () => {
    it("should flag when invoice date is after received date", async () => {
      const receivedDate = new Date("2024-01-15");
      const invoiceDate = new Date("2024-01-20");

      await prisma.invoiceRecord.create({
        data: {
          organizationId: testOrgId,
          externalInvoiceId: "INV-DATE-001",
          sourceSystem: "xero",
          vendorId: "vendor-date",
          vendorName: "Test Vendor",
          invoiceDate,
          receivedDate,
          totalAmount: new Decimal("1000.00"),
          lineItems: undefined,
          reconciliationStatus: "matched",
          processed: false,
        },
      });

      const result = await detectInvoiceAnomalies(testOrgId);

      expect(result.detectedCount).toBeGreaterThan(0);

      const dateAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "date_inconsistency",
          invoice: { organizationId: testOrgId },
        },
      });

      expect(dateAnomalies.length).toBeGreaterThan(0);
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
          unitPrice: 100,
        },
      ];

      await prisma.invoiceRecord.create({
        data: {
          organizationId: testOrgId,
          externalInvoiceId: "INV-OVERBILL-001",
          sourceSystem: "xero",
          vendorId: "vendor-overbill",
          vendorName: "Test Vendor",
          invoiceDate: new Date(),
          receivedDate: new Date(),
          totalAmount: new Decimal("5000.00"),
          lineItems: lineItems as any,
          reconciliationStatus: "unmatched",
          processed: false,
        },
      });

      const result = await detectInvoiceAnomalies(testOrgId);

      expect(result.detectedCount).toBeGreaterThan(0);

      const overbillAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "over_billing",
          invoice: { organizationId: testOrgId },
        },
      });

      expect(overbillAnomalies.length).toBeGreaterThan(0);
      expect(overbillAnomalies[0].severity).toBe("critical");
    });
  });

  describe("Missing GRN Detection", () => {
    it("should flag invoices with no received date", async () => {
      await prisma.invoiceRecord.create({
        data: {
          organizationId: testOrgId,
          externalInvoiceId: "INV-NOGRN-001",
          sourceSystem: "xero",
          vendorId: "vendor-nogrn",
          vendorName: "Test Vendor",
          invoiceDate: new Date(),
          receivedDate: null,
          totalAmount: new Decimal("1000.00"),
          lineItems: undefined,
          reconciliationStatus: "unmatched",
          processed: false,
        },
      });

      const result = await detectInvoiceAnomalies(testOrgId);

      expect(result.detectedCount).toBeGreaterThan(0);

      const grnAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "missing_grn",
          invoice: { organizationId: testOrgId },
        },
      });

      expect(grnAnomalies.length).toBeGreaterThan(0);
      expect(grnAnomalies[0].severity).toBe("info");
    });
  });

  describe("Unmatched Invoice Detection", () => {
    it("should flag invoices with no line items", async () => {
      await prisma.invoiceRecord.create({
        data: {
          organizationId: testOrgId,
          externalInvoiceId: "INV-UNMATCHED-001",
          sourceSystem: "xero",
          vendorId: "vendor-unmatched",
          vendorName: "Test Vendor",
          invoiceDate: new Date(),
          receivedDate: new Date(),
          totalAmount: new Decimal("1000.00"),
          lineItems: undefined,
          reconciliationStatus: "unmatched",
          processed: false,
        },
      });

      const result = await detectInvoiceAnomalies(testOrgId);

      expect(result.detectedCount).toBeGreaterThan(0);

      const unmatchedAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          anomalyType: "unmatched_invoice",
          invoice: { organizationId: testOrgId },
        },
      });

      expect(unmatchedAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe("Anomaly Resolution", () => {
    it("should allow approving and rejecting anomalies", async () => {
      const lineItems = [
        {
          itemId: "item-1",
          itemDescription: "Waste",
          quantityInvoiced: 50,
          quantityReceived: 0,
        },
      ];

      const invoice = await prisma.invoiceRecord.create({
        data: {
          organizationId: testOrgId,
          externalInvoiceId: "INV-RESOLVE-001",
          sourceSystem: "xero",
          vendorId: "vendor-resolve",
          vendorName: "Test Vendor",
          invoiceDate: new Date(),
          receivedDate: new Date(),
          totalAmount: new Decimal("5000.00"),
          lineItems: lineItems as any,
          reconciliationStatus: "unmatched",
          processed: false,
        },
      });

      await detectInvoiceAnomalies(testOrgId);

      const anomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          invoiceId: invoice.id,
        },
      });

      expect(anomalies.length).toBeGreaterThan(0);

      const anomaly = anomalies[0];

      await prisma.invoiceAnomaly.update({
        where: { id: anomaly.id },
        data: {
          resolution: "approved",
          resolutionNotes: "Verified and corrected",
          resolvedAt: new Date(),
        },
      });

      const resolved = await prisma.invoiceAnomaly.findUnique({
        where: { id: anomaly.id },
      });

      expect(resolved?.resolution).toBe("approved");
      expect(resolved?.resolutionNotes).toBe("Verified and corrected");
    });
  });

  describe("Severity Levels", () => {
    it("should correctly classify anomaly severities", async () => {
      // Create multiple types of anomalies with expected severities

      // Critical: over-billing
      await prisma.invoiceRecord.create({
        data: {
          organizationId: testOrgId,
          externalInvoiceId: "INV-CRITICAL-001",
          sourceSystem: "xero",
          vendorId: "vendor-critical",
          vendorName: "Test Vendor",
          invoiceDate: new Date(),
          receivedDate: new Date(),
          totalAmount: new Decimal("5000.00"),
          lineItems: [
            {
              itemId: "item-1",
              quantityInvoiced: 50,
              quantityReceived: 0,
            },
          ] as any,
          reconciliationStatus: "unmatched",
          processed: false,
        },
      });

      // Warning: quantity mismatch
      await prisma.invoiceRecord.create({
        data: {
          organizationId: testOrgId,
          externalInvoiceId: "INV-WARNING-001",
          sourceSystem: "xero",
          vendorId: "vendor-warning",
          vendorName: "Test Vendor",
          invoiceDate: new Date(),
          receivedDate: new Date(),
          totalAmount: new Decimal("5000.00"),
          lineItems: [
            {
              itemId: "item-1",
              quantityReceived: 80,
              quantityInvoiced: 100,
            },
          ] as any,
          reconciliationStatus: "matched",
          processed: false,
        },
      });

      // Info: missing GRN
      await prisma.invoiceRecord.create({
        data: {
          organizationId: testOrgId,
          externalInvoiceId: "INV-INFO-001",
          sourceSystem: "xero",
          vendorId: "vendor-info",
          vendorName: "Test Vendor",
          invoiceDate: new Date(),
          receivedDate: null,
          totalAmount: new Decimal("1000.00"),
          lineItems: undefined,
          reconciliationStatus: "unmatched",
          processed: false,
        },
      });

      const result = await detectInvoiceAnomalies(testOrgId);

      const criticalAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          severity: "critical",
          invoice: { organizationId: testOrgId },
        },
      });

      const warningAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          severity: "warning",
          invoice: { organizationId: testOrgId },
        },
      });

      const infoAnomalies = await prisma.invoiceAnomaly.findMany({
        where: {
          severity: "info",
          invoice: { organizationId: testOrgId },
        },
      });

      expect(criticalAnomalies.length).toBeGreaterThan(0);
      expect(warningAnomalies.length).toBeGreaterThan(0);
      expect(infoAnomalies.length).toBeGreaterThan(0);
    });
  });
});
