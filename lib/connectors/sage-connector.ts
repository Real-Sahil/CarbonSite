// Sage connector — parse supplier invoices and purchase orders to extract spend-based emissions data
// Supports Sage 50, Sage 100, and Sage Intacct

import { z } from "zod";
import type { ConnectorPayload, ConnectorActivityRecord, IConnector } from "./types";

const SageRowSchema = z.object({
  invoiceRef: z.string(), // Purchase invoice reference
  invoiceDate: z.string(), // ISO date or DD/MM/YYYY
  supplier: z.string().optional(),
  netAmount: z.string(),
  currency: z.string().optional().default("GBP"),
  nominialCode: z.string().optional(), // GL nominal account code
  department: z.string().optional(),
  description: z.string().optional(),
  costCode: z.string().optional(), // Project/cost code
});

type SageRow = z.infer<typeof SageRowSchema>;

// GL Nominal codes → Category mapping (Sage standard chart of accounts)
const NOMINAL_TO_CATEGORY: Record<string, string> = {
  // Scope 1
  "5000": "s1-stationary", // Fuel and power
  "5001": "s1-mobile", // Vehicle fuel
  "5002": "s1-stationary", // Maintenance & repairs
  "5010": "s1-stationary", // Utilities (gas, electric)

  // Scope 2
  "5100": "s2-electricity-lb", // Electricity
  "5101": "s2-electricity-lb", // Gas supply

  // Scope 3
  "6000": "s3-purchased-goods", // Materials & components (spend-based fallback)
  "6001": "s3-purchased-goods", // Packaging materials
  "6010": "s3-upstream-transport", // Freight & carriage
  "6020": "s3-upstream-transport", // Carriers & shipping
  "6100": "s3-business-travel", // Travel & subsistence
  "6101": "s3-business-travel", // Accommodation
  "6102": "s3-commuting", // Employee travel
};

export class SageConnector implements IConnector {
  name = "sage";
  version = "1.0";

  async ingest(payload: unknown): Promise<ConnectorPayload> {
    const payloadSchema = z.object({
      rows: z.array(z.record(z.unknown())),
      externalBatchId: z.string().optional(),
    });

    const parsed = payloadSchema.parse(payload);

    const records: ConnectorActivityRecord[] = [];
    const errors: string[] = [];

    for (let idx = 0; idx < parsed.rows.length; idx++) {
      const rowData = parsed.rows[idx];

      try {
        const row = SageRowSchema.parse(rowData);

        if (!row.invoiceRef || row.invoiceRef.trim() === "") {
          throw new Error("Invoice reference is required");
        }

        const amount = this.parseAmount(row.netAmount);
        if (amount === 0) {
          throw new Error("Net amount must be a valid number > 0");
        }

        const record = this.parseSageRow(row, idx + 1, parsed.externalBatchId);
        records.push(record);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${idx + 1}: ${msg}`);
      }
    }

    if (records.length === 0) {
      throw new Error(`No valid records found in Sage export. Errors: ${errors.join("; ")}`);
    }

    return {
      records,
      metadata: {
        provider: "sage",
        ingestionDate: new Date(),
        sourceSystem: "sage_invoice_export",
        externalBatchId: parsed.externalBatchId,
      },
    };
  }

  private parseSageRow(
    row: SageRow,
    rowNumber: number,
    externalBatchId: string | undefined
  ): ConnectorActivityRecord {
    const activityDate = this.parseDate(row.invoiceDate);

    // Map GL nominal code to category
    const categoryCode =
      NOMINAL_TO_CATEGORY[row.nominialCode || "6000"] || "s3-purchased-goods";

    const supplierName =
      row.supplier || row.description?.split(" ").slice(0, 3).join(" ") || "Unknown";

    const spendAmount = this.parseAmount(row.netAmount);

    // Flag spend-based records
    const warnings: string[] = [];
    if (!row.description?.match(/\d+\s*(kg|tonne|litre|l|kWh|kwh|km)/i)) {
      warnings.push(
        "No physical quantity found in description. Using spend-based fallback."
      );
    }

    return {
      externalRecordId: row.invoiceRef,
      externalBatchId,
      emissionCategoryCode: categoryCode,
      activityDate,

      // Spend-based fallback
      spendAmount,
      spendCurrency: row.currency || "GBP",

      // Context
      sourceDescription: `Sage Invoice ${row.invoiceRef}`,
      supplierName,
      businessUnitCode: row.costCode || row.department,

      // Warnings
      validationWarnings: warnings,

      // Placeholder quantity
      amount: spendAmount,
      unit: "GBP",
    };
  }

  private parseDate(dateStr: string): Date {
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try DD/MM/YYYY format
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      return new Date(year, month - 1, day);
    }

    console.warn(`[sage-connector] Could not parse date "${dateStr}", using today`);
    return new Date();
  }

  private parseAmount(amountStr: string): number {
    return parseFloat(amountStr.replace(/,/g, "")) || 0;
  }
}
