// Xero connector — parse invoices and bills to extract spend-based emissions data
// Xero export format: CSV with columns [InvoiceNumber, Date, Supplier, Amount, Account, Description]

import { z } from "zod";
import type { ConnectorPayload, ConnectorActivityRecord, IConnector } from "./types";

const XeroRowSchema = z.object({
  InvoiceNumber: z.string(),
  Date: z.string(), // ISO date or DD/MM/YYYY
  Supplier: z.string().optional(),
  Amount: z.string(),
  Currency: z.string().optional().default("GBP"),
  Account: z.string().optional(),
  Description: z.string().optional(),
});

type XeroRow = z.infer<typeof XeroRowSchema>;

// Mapping: Xero account codes → CarbonSite emission categories
// (this would be configurable per org in production)
const ACCOUNT_TO_CATEGORY: Record<string, string> = {
  // Scope 1
  "5000": "s1-stationary", // Fuel & heating
  "5001": "s1-mobile", // Fleet fuel
  "5002": "s1-stationary", // Refrigeration

  // Scope 2
  "5100": "s2-electricity-lb", // Electricity (location-based default)

  // Scope 3 (highest-uncertainty — these trigger auto-supplier-data-requests)
  "6000": "s3-purchased-goods", // Goods & materials (spend-based fallback)
  "6001": "s3-upstream-transport", // Logistics & freight
  "6100": "s3-business-travel", // Employee travel expenses
};

export class XeroConnector implements IConnector {
  name = "xero";
  version = "1.0";

  async ingest(payload: unknown): Promise<ConnectorPayload> {
    // Payload expected: { rows: [...], externalBatchId?: string }
    const payloadSchema = z.object({
      rows: z.array(z.record(z.unknown())),
      externalBatchId: z.string().optional(),
    });

    const parsed = payloadSchema.parse(payload);

    // Parse and validate each row
    const records: ConnectorActivityRecord[] = [];
    const errors: string[] = [];

    for (let idx = 0; idx < parsed.rows.length; idx++) {
      const rowData = parsed.rows[idx];

      try {
        const row = XeroRowSchema.parse(rowData);

        // Strict validation: require InvoiceNumber and valid Amount
        if (!row.InvoiceNumber || row.InvoiceNumber.trim() === "") {
          throw new Error("InvoiceNumber is required");
        }

        const amount = this.parseAmount(row.Amount);
        if (amount === 0) {
          throw new Error("Amount must be a valid number > 0");
        }

        const record = this.parseXeroRow(row, idx + 1, parsed.externalBatchId);
        records.push(record);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${idx + 1}: ${msg}`);
      }
    }

    if (records.length === 0) {
      throw new Error(`No valid records found in Xero export. Errors: ${errors.join("; ")}`);
    }

    return {
      records,
      metadata: {
        provider: "xero",
        ingestionDate: new Date(),
        sourceSystem: "xero_invoice_export",
        externalBatchId: parsed.externalBatchId,
      },
    };
  }

  private parseXeroRow(
    row: XeroRow,
    rowNumber: number,
    externalBatchId: string | undefined
  ): ConnectorActivityRecord {
    // Parse date
    const activityDate = this.parseDate(row.Date);

    // Map account to category, default to Scope 3 if unmapped (high uncertainty)
    const categoryCode =
      ACCOUNT_TO_CATEGORY[row.Account || "6000"] || "s3-purchased-goods";

    // Extract supplier name from invoice description or use "Xero Import"
    const supplierName =
      row.Supplier || row.Description?.split(" ").slice(0, 3).join(" ") || "Unknown";

    // Parse amount (usually in format "1000.00" or "1,000.00")
    const spendAmount = this.parseAmount(row.Amount);

    // Warnings if no quantity (spend-based fallback)
    const warnings: string[] = [];
    if (!row.Description?.includes("kg") && !row.Description?.includes("litres")) {
      warnings.push(
        "No physical quantity found in description. Using spend-based fallback."
      );
    }

    return {
      externalRecordId: row.InvoiceNumber,
      externalBatchId,
      emissionCategoryCode: categoryCode,
      activityDate,

      // Spend-based fallback (high uncertainty)
      spendAmount,
      spendCurrency: row.Currency || "GBP",

      // Context
      sourceDescription: `Xero Invoice ${row.InvoiceNumber}`,
      supplierName,

      // Warnings
      validationWarnings: warnings,

      // Placeholder quantity (will be estimated from spend)
      amount: spendAmount, // Temporary; actual calculation uses spend-based factor
      unit: "GBP", // Currency used as proxy for spend-based
    };
  }

  private parseDate(dateStr: string): Date {
    // Try ISO format first
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

    // Default to today
    console.warn(
      `[xero-connector] Could not parse date "${dateStr}", using today`
    );
    return new Date();
  }

  private parseAmount(amountStr: string): number {
    // Remove commas and convert to float
    return parseFloat(amountStr.replace(/,/g, "")) || 0;
  }
}
