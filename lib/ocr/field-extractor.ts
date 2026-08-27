/**
 * Field Extractor with Instructor
 * Extracts structured waste/evidence fields from OCR text using LLM
 *
 * Uses Instructor (https://github.com/jxnl/instructor) pattern to extract
 * structured JSON from unstructured OCR output via Claude/GPT with schema validation.
 *
 * Extracted Fields:
 * - weight (kg)
 * - ewcCode (European Waste Classification code)
 * - date (ISO 8601)
 * - supplier (company name)
 * - facility (receiving facility name)
 * - vehicleReg (vehicle registration plate)
 * - notes (additional observations)
 */

import { z } from "zod";
import { LlmClient } from "@/lib/llm/client";

/**
 * Schema for structured field extraction
 * Zod for validation, also used by LLM for structured output
 */
export const WasteFieldSchema = z.object({
  weight: z
    .number()
    .positive("Weight must be positive")
    .optional()
    .describe("Weight in kilograms"),

  ewcCode: z
    .string()
    .regex(/^\d{6}$/, "EWC code must be 6 digits")
    .optional()
    .describe("European Waste Classification code (6 digits)"),

  date: z
    .string()
    .datetime()
    .optional()
    .describe("ISO 8601 date when waste was generated or received"),

  supplier: z
    .string()
    .max(256)
    .optional()
    .describe("Name of company/facility that generated or transported waste"),

  facility: z
    .string()
    .max(256)
    .optional()
    .describe("Name of receiving facility or landfill"),

  vehicleReg: z
    .string()
    .max(20)
    .optional()
    .describe("Vehicle registration plate or transport ID"),

  notes: z
    .string()
    .max(512)
    .optional()
    .describe("Additional notes or observations"),

  confidence: z
    .object({
      weight: z.number().min(0).max(1).optional(),
      ewcCode: z.number().min(0).max(1).optional(),
      date: z.number().min(0).max(1).optional(),
      supplier: z.number().min(0).max(1).optional(),
      facility: z.number().min(0).max(1).optional(),
      vehicleReg: z.number().min(0).max(1).optional(),
    })
    .optional()
    .describe("Confidence scores (0-1) for each extracted field"),
});

export type WasteField = z.infer<typeof WasteFieldSchema>;

export type FieldExtractionResult = {
  status: "success" | "partial" | "error";
  fields: Partial<WasteField>;
  extractedFieldsCount: number;
  totalFieldsAttempted: number;
  rawOcrText: string;
  error?: string;
  warnings: string[];
};

/**
 * Extract structured waste fields from OCR text
 *
 * This simulates the Instructor pattern by:
 * 1. Sending OCR text + schema to LLM
 * 2. Requesting JSON output matching schema
 * 3. Validating with Zod
 * 4. Returning structured data with confidence scores
 *
 * In production, use instructor library:
 * ```
 * import Instructor from "@jxnl/instructor"
 * import Anthropic from "@anthropic-ai/sdk"
 *
 * const client = Instructor({
 *   client: new Anthropic(),
 *   mode: "TOOLS"
 * })
 *
 * const result = await client.messages.create({
 *   model: "claude-opus-4-1-20250805",
 *   max_tokens: 1024,
 *   messages: [
 *     { role: "user", content: `Extract fields from: ${ocrText}` }
 *   ],
 *   response_model: WasteFieldSchema
 * })
 * ```
 */
export async function extractWasteFields(ocrText: string): Promise<FieldExtractionResult> {
  if (!ocrText || ocrText.trim().length === 0) {
    return {
      status: "error",
      fields: {},
      extractedFieldsCount: 0,
      totalFieldsAttempted: 0,
      rawOcrText: ocrText,
      error: "No OCR text provided",
      warnings: [],
    };
  }

  const llm = new LlmClient();
  const extractionPrompt = `Extract waste/delivery information from the following OCR text. Return ONLY valid JSON (no markdown, no code blocks, just raw JSON).

OCR Text:
${ocrText}

Extract these fields if present:
- weight: numeric value in kilograms
- ewcCode: European Waste Classification code (6 digits, e.g., 150110)
- date: ISO 8601 date when waste was generated/received
- supplier: company/facility that generated or transported waste
- facility: receiving facility or landfill name
- vehicleReg: vehicle registration plate
- notes: additional observations

For each field you extract, include a confidence score (0-1) indicating how confident you are.

Return JSON in this exact format:
{
  "weight": number or null,
  "ewcCode": string or null,
  "date": string or null,
  "supplier": string or null,
  "facility": string or null,
  "vehicleReg": string or null,
  "notes": string or null,
  "confidence": {
    "weight": number 0-1 or null,
    "ewcCode": number 0-1 or null,
    "date": number 0-1 or null,
    "supplier": number 0-1 or null,
    "facility": number 0-1 or null,
    "vehicleReg": number 0-1 or null
  }
}`;

  let validated: WasteField;
  try {
    const result = await llm.chat(
      [{ role: "user", content: extractionPrompt }],
      { maxTokens: 500, temperature: 0.1 }
    );

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("LLM response did not contain valid JSON");
    }

    const extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    validated = WasteFieldSchema.parse(extracted);
  } catch (llmErr) {
    // Fallback: use regex-based extraction when LLM fails
    console.warn(
      "[field-extractor] LLM extraction failed, falling back to regex:",
      llmErr instanceof Error ? llmErr.message : String(llmErr),
    );

    const weightMatch = ocrText.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilograms?)/i);
    const ewcMatch = ocrText.match(/\b\d{6}\b/);
    const dateMatch = ocrText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
    const supplierMatch = ocrText.match(/(?:supplier|company|from):\s*([^\n]+)/i);
    const facilityMatch = ocrText.match(/(?:facility|to|destination):\s*([^\n]+)/i);

    let parsedDate: string | undefined;
    if (dateMatch) {
      try {
        const date = new Date(dateMatch[1]);
        if (!Number.isNaN(date.getTime())) {
          parsedDate = date.toISOString();
        }
      } catch {
        parsedDate = undefined;
      }
    }

    validated = WasteFieldSchema.parse({
      weight: weightMatch ? parseFloat(weightMatch[1].replace(",", ".")) : undefined,
      ewcCode: ewcMatch ? ewcMatch[0] : undefined,
      date: parsedDate,
      supplier: supplierMatch ? supplierMatch[1].trim() : undefined,
      facility: facilityMatch ? facilityMatch[1].trim() : undefined,
      confidence: {
        weight: weightMatch ? 0.6 : undefined,
        ewcCode: ewcMatch ? 0.5 : undefined,
        date: parsedDate ? 0.6 : undefined,
        supplier: supplierMatch ? 0.5 : undefined,
        facility: facilityMatch ? 0.5 : undefined,
      },
    });
  }

  const extractedCount = Object.entries(validated)
    .filter(([key, value]) => key !== "confidence" && value !== undefined)
    .length;

  const warnings: string[] = [];
  const avgConfidence =
    validated.confidence &&
    Object.values(validated.confidence).filter((c): c is number => typeof c === "number").length > 0
      ? Object.values(validated.confidence)
          .filter((c): c is number => typeof c === "number")
          .reduce((a, b) => a + b, 0) /
        Object.values(validated.confidence).filter((c): c is number => typeof c === "number").length
      : 0;

  if (avgConfidence < 0.7) {
    warnings.push("Low extraction confidence detected - review fields carefully");
  }

  return {
    status: extractedCount > 0 ? "success" : "partial",
    fields: validated,
    extractedFieldsCount: extractedCount,
    totalFieldsAttempted: 6,
    rawOcrText: ocrText,
    warnings,
  };
}

/**
 * Validate field confidence and flag low-confidence extractions
 * Used to determine if user review is required
 */
export function validateFieldConfidence(
  fields: Partial<WasteField>,
  confidenceThreshold = 0.80,
): {
  isConfident: boolean;
  lowConfidenceFields: string[];
  avgConfidence: number;
} {
  if (!fields.confidence) {
    return { isConfident: false, lowConfidenceFields: [], avgConfidence: 0 };
  }

  const confidences = Object.entries(fields.confidence).filter(
    ([, score]) => typeof score === "number",
  );

  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((sum, [, score]) => sum + score, 0) / confidences.length
      : 0;

  const lowConfidenceFields = confidences
    .filter(([, score]) => score < confidenceThreshold)
    .map(([field]) => field);

  return {
    isConfident: lowConfidenceFields.length === 0,
    lowConfidenceFields,
    avgConfidence,
  };
}

/**
 * Merge OCR-extracted fields with user corrections
 * Called after user reviews/corrects the extracted data
 */
export function mergeWithUserCorrections(
  extracted: Partial<WasteField>,
  userInput: Partial<WasteField>,
): Partial<WasteField> {
  // User corrections override extracted fields
  const merged = { ...extracted };

  Object.entries(userInput).forEach(([key, value]) => {
    if (value !== undefined && value !== null && key !== "confidence") {
      // Safe to cast since we've excluded "confidence"
      (merged as Record<string, unknown>)[key] = value;
    }
  });

  // Recalculate confidence for corrected fields
  const confidence = merged.confidence;
  if (confidence) {
    Object.entries(userInput).forEach(([key]) => {
      if (key !== "confidence" && key in confidence) {
        // User-corrected fields get 1.0 confidence
        (confidence as Record<string, number>)[key] = 1.0;
      }
    });
  }

  return merged;
}

/**
 * Export extracted fields as CSV row (for batch processing)
 */
export function fieldsToCSVRow(fields: Partial<WasteField>): string {
  const row = [
    fields.date || "",
    fields.supplier || "",
    fields.facility || "",
    fields.weight || "",
    fields.ewcCode || "",
    fields.vehicleReg || "",
    fields.notes || "",
  ];

  return row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
}

/**
 * Estimate data quality for submission
 */
export function estimateDataQuality(fields: Partial<WasteField>): {
  quality: "high" | "medium" | "low";
  score: number; // 0-100
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Critical fields: weight, ewc_code, date
  const hasCritical = fields.weight && fields.ewcCode && fields.date;
  if (!hasCritical) {
    feedback.push("Missing critical fields: weight, EWC code, or date");
  } else {
    score += 40;
  }

  // Supporting fields: supplier, facility
  if (fields.supplier && fields.facility) {
    score += 30;
  } else if (fields.supplier || fields.facility) {
    score += 15;
    feedback.push("Consider adding both supplier and facility for full traceability");
  } else {
    feedback.push("Supplier and facility are recommended for audit trail");
  }

  // Confidence scores
  if (fields.confidence) {
    const avgConfidence =
      Object.values(fields.confidence).reduce((a, b) => a + b, 0) /
      Object.keys(fields.confidence).length;
    score += Math.floor(avgConfidence * 30);

    if (avgConfidence < 0.7) {
      feedback.push("Low OCR confidence detected - review extracted fields");
    }
  }

  const quality = score >= 75 ? "high" : score >= 50 ? "medium" : "low";

  return {
    quality,
    score: Math.min(100, score),
    feedback,
  };
}
