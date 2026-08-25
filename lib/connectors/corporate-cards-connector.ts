// Corporate Cards connector — parse credit card transaction feeds to extract travel & expenses
// Supports Amex, Mastercard, Visa, and aggregator exports (Expensify, Concur, etc.)

import { z } from "zod";
import type { ConnectorPayload, ConnectorActivityRecord, IConnector } from "./types";

const CorporateCardRowSchema = z.object({
  transactionId: z.string(),
  transactionDate: z.string(), // ISO date or DD/MM/YYYY
  merchant: z.string(),
  category: z.enum([
    "airfare",
    "hotel",
    "car_rental",
    "public_transport",
    "fuel",
    "restaurant",
    "taxi_rideshare",
    "other",
  ]),
  amount: z.string(),
  currency: z.string().optional().default("GBP"),
  employeeName: z.string().optional(),
  description: z.string().optional(),
  reference: z.string().optional(), // PNR, booking ref, etc.
});

type CorporateCardRow = z.infer<typeof CorporateCardRowSchema>;

// Card category → Emission category mapping
const CARD_TO_EMISSION: Record<string, string> = {
  airfare: "s3-business-travel",
  hotel: "s3-business-travel",
  car_rental: "s3-business-travel",
  public_transport: "s3-business-travel",
  fuel: "s1-mobile", // Fuel purchased on corporate card
  taxi_rideshare: "s3-business-travel",
  restaurant: "s3-purchased-goods", // Meals/catering as spend
  other: "s3-purchased-goods", // Default to general goods
};

// Merchant keywords → Category override
const MERCHANT_PATTERNS: Array<[RegExp, string]> = [
  [/^(united|american|british|lufthansa|ryanair|easyjet|ba |virgin|southwest)/i, "s3-business-travel"],
  [/^(marriott|hilton|hyatt|travelodge|premier inn|holiday inn|ibis|radisson|accor)/i, "s3-business-travel"],
  [/^(hertz|avis|enterprise|europcar|budget|alamo|sixt)/i, "s3-business-travel"],
  [/^(eurostar|national rail|tfl|transport|metro|mta|greyhound|amtrak)/i, "s3-business-travel"],
  [/^(uber|lyft|addison|bolt|taxify|mytaxi|gett|whippet|black cab)/i, "s3-business-travel"],
  [/^(bp |shell|esso|tesco fuel|asda fuel|sainsbury|morrisons fuel)/i, "s1-mobile"],
];

export class CorporateCardsConnector implements IConnector {
  name = "corporate_cards";
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
        const row = CorporateCardRowSchema.parse(rowData);

        if (!row.transactionId || row.transactionId.trim() === "") {
          throw new Error("Transaction ID is required");
        }

        const amount = this.parseAmount(row.amount);
        if (amount <= 0) {
          throw new Error("Amount must be a valid number > 0");
        }

        const record = this.parseCardRow(row, idx + 1, parsed.externalBatchId);
        records.push(record);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${idx + 1}: ${msg}`);
      }
    }

    if (records.length === 0) {
      throw new Error(`No valid records found in card feed. Errors: ${errors.join("; ")}`);
    }

    return {
      records,
      metadata: {
        provider: "corporate_cards",
        ingestionDate: new Date(),
        sourceSystem: "corporate_card_feed",
        externalBatchId: parsed.externalBatchId,
      },
    };
  }

  private parseCardRow(
    row: CorporateCardRow,
    rowNumber: number,
    externalBatchId: string | undefined
  ): ConnectorActivityRecord {
    const activityDate = this.parseDate(row.transactionDate);
    const spendAmount = this.parseAmount(row.amount);

    // Determine emission category from merchant or card category
    let categoryCode = this.determineCategoryFromMerchant(row.merchant) || CARD_TO_EMISSION[row.category];

    const supplierName = row.merchant || "Unknown Merchant";

    // Build source description
    const sourceDescription = `Corporate Card ${row.transactionId} — ${row.merchant}`;

    const warnings: string[] = [];

    // All card transactions are spend-based (no physical quantity)
    warnings.push(
      "Card transactions use spend-based emission factors. Physical quantity data would improve accuracy."
    );

    // Additional warnings based on category
    if (row.category === "restaurant") {
      warnings.push(
        "Restaurant/catering spend allocated to Scope 3 Purchased Goods. Review if employee meal or business catering."
      );
    }

    return {
      externalRecordId: row.transactionId,
      externalBatchId,
      emissionCategoryCode: categoryCode,
      activityDate,

      // Spend-based only (no physical quantity)
      spendAmount,
      spendCurrency: row.currency || "GBP",

      // Context
      sourceDescription,
      supplierName,
      country: "UK", // Default; would need geocoding for international cards
      region: this.inferRegionFromMerchant(row.merchant, row.category),

      // Transport mode if travel-related
      transportMode: this.inferTransportMode(row.category),

      // Reference for manual reconciliation
      facilityCode: row.reference,

      // Warnings
      validationWarnings: warnings,

      // Placeholder quantity (will use spend-based factor)
      amount: spendAmount,
      unit: "GBP",
    };
  }

  private parseDate(dateStr: string): Date {
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      return new Date(year, month - 1, day);
    }

    console.warn(`[corporate-cards-connector] Could not parse date "${dateStr}", using today`);
    return new Date();
  }

  private parseAmount(amountStr: string): number {
    return parseFloat(amountStr.replace(/,/g, "").replace(/[^0-9.]/g, "")) || 0;
  }

  private determineCategoryFromMerchant(merchant: string): string | undefined {
    // Check merchant name against known patterns
    for (const [pattern, category] of MERCHANT_PATTERNS) {
      if (pattern.test(merchant)) {
        return category;
      }
    }
    return undefined;
  }

  private inferTransportMode(category: string): string | undefined {
    const mapping: Record<string, string> = {
      airfare: "flight",
      car_rental: "car",
      public_transport: "rail",
      taxi_rideshare: "car",
      fuel: "car",
    };
    return mapping[category];
  }

  private inferRegionFromMerchant(merchant: string, category: string): string | undefined {
    // Try to detect if transaction is overseas (would need geocoding service for production)
    const overseasKeywords = /\b(US|USA|US\$|USD|\$|Europe|France|Germany|Spain|Italy|Asia|Australia|Canada|Dubai|Singapore|Japan)\b/i;

    if (overseasKeywords.test(merchant)) {
      return "International";
    }

    // Default to UK for corporate card
    return "UK";
  }
}
