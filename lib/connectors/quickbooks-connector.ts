// QuickBooks connector — parse invoices and bills to extract spend-based emissions data
// Supports both QuickBooks Online and Desktop exports

import { z } from "zod";
import type { ConnectorPayload, ConnectorActivityRecord, IConnector } from "./types";

const QuickBooksRowSchema = z.object({
  docNumber: z.string(), // Invoice/Bill number
  docDate: z.string(), // ISO date
  vendor: z.string().optional(),
  customer: z.string().optional(),
  amount: z.string(),
  currency: z.string().optional().default("GBP"),
  accountCode: z.string().optional(),
  description: z.string().optional(),
  docType: z.enum(["Bill", "Invoice", "Expense"]), // Bill=outgoing, Invoice=incoming, Expense=direct
  class: z.string().optional(), // QBO class (cost center)
  department: z.string().optional(), // QBO department
});

type QuickBooksRow = z.infer<typeof QuickBooksRowSchema>;

// Account → Category mapping (QuickBooks chart of accounts)
const ACCOUNT_TO_CATEGORY: Record<string, string> = {
  // Scope 1
  "5000": "s1-stationary", // Fuel & utilities
  "5010": "s1-mobile", // Fleet fuel
  "5020": "s1-stationary", // Equipment maintenance
  "5030": "s1-stationary", // Refrigeration/HVAC

  // Scope 2
  "5100": "s2-electricity-lb", // Electricity
  "5110": "s2-electricity-lb", // Gas utility
  "5120": "s2-electricity-lb", // Water utility

  // Scope 3
  "6000": "s3-purchased-goods", // Materials & supplies (spend-based fallback)
  "6010": "s3-upstream-transport", // Freight & shipping
  "6020": "s3-upstream-transport", // Courier & delivery
  "6100": "s3-business-travel", // Airfare
  "6110": "s3-business-travel", // Hotel & accommodation
  "6120": "s3-business-travel", // Car rental
  "6200": "s3-commuting", // Employee travel allowances
};

export class QuickBooksConnector implements IConnector {
  name = "quickbooks";
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
        const row = QuickBooksRowSchema.parse(rowData);

        // Skip non-Bill/Expense documents (invoices are customer receivables, not spend)
        if (row.docType === "Invoice") {
          throw new Error("Invoices are customer receivables, not emissions-relevant spend");
        }

        if (!row.docNumber || row.docNumber.trim() === "") {
          throw new Error("Document number is required");
        }

        const amount = this.parseAmount(row.amount);
        if (amount === 0) {
          throw new Error("Amount must be a valid number > 0");
        }

        const record = this.parseQuickBooksRow(row, idx + 1, parsed.externalBatchId);
        records.push(record);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${idx + 1}: ${msg}`);
      }
    }

    if (records.length === 0) {
      throw new Error(`No valid records found in QuickBooks export. Errors: ${errors.join("; ")}`);
    }

    return {
      records,
      metadata: {
        provider: "quickbooks",
        ingestionDate: new Date(),
        sourceSystem: "quickbooks_export",
        externalBatchId: parsed.externalBatchId,
      },
    };
  }

  private parseQuickBooksRow(
    row: QuickBooksRow,
    rowNumber: number,
    externalBatchId: string | undefined
  ): ConnectorActivityRecord {
    const activityDate = this.parseDate(row.docDate);

    // Map account code to category, default to Scope 3
    const categoryCode = ACCOUNT_TO_CATEGORY[row.accountCode || "6000"] || "s3-purchased-goods";

    // Use vendor name if available (from Bill/Expense), otherwise customer or description
    const supplierName =
      row.vendor || row.customer || row.description?.split(" ").slice(0, 2).join(" ") || "Unknown";

    const spendAmount = this.parseAmount(row.amount);

    // Flag records without physical quantity
    const warnings: string[] = [];
    if (!row.description?.match(/\d+\s*(kg|tonne|litre|l|kWh|km)/i)) {
      warnings.push(
        "No physical quantity found in description. Using spend-based fallback."
      );
    }

    // Add cost center/department as business unit code if available
    const businessUnitCode = row.class || row.department;

    return {
      externalRecordId: row.docNumber,
      externalBatchId,
      emissionCategoryCode: categoryCode,
      activityDate,

      // Spend-based fallback
      spendAmount,
      spendCurrency: row.currency || "GBP",

      // Context
      sourceDescription: `QuickBooks ${row.docType} ${row.docNumber}`,
      supplierName,
      businessUnitCode,

      // Warnings
      validationWarnings: warnings,

      // Placeholder quantity (will be estimated from spend)
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

    console.warn(
      `[quickbooks-connector] Could not parse date "${dateStr}", using today`
    );
    return new Date();
  }

  private parseAmount(amountStr: string): number {
    return parseFloat(amountStr.replace(/,/g, "")) || 0;
  }
}
