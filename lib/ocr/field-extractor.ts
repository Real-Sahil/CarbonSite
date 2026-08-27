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

  // Simulate LLM extraction (in production, call actual LLM via Instructor)
  // This demonstrates the pattern and structure
  const mockExtractedData: WasteField = {
    weight: 50.5,
    ewcCode: "150110",
    date: new Date().toISOString(),
    supplier: "ABC Waste Management",
    facility: "Regional Landfill",
    vehicleReg: "AB21 CDE",
    notes: "Standard waste delivery",
    confidence: {
      weight: 0.95,
      ewcCode: 0.87,
      date: 0.92,
      supplier: 0.89,
      facility: 0.91,
      vehicleReg: 0.88,
    },
  };

  // Validate extracted data with Zod
  try {
    const validated = WasteFieldSchema.parse(mockExtractedData);

    const extractedCount = Object.entries(validated)
      .filter(([key, value]) => key !== "confidence" && value !== undefined)
      .length;

    return {
      status: extractedCount > 0 ? "success" : "partial",
      fields: validated,
      extractedFieldsCount: extractedCount,
      totalFieldsAttempted: 6,
      rawOcrText: ocrText,
      warnings: [],
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    return {
      status: "error",
      fields: {},
      extractedFieldsCount: 0,
      totalFieldsAttempted: 6,
      rawOcrText: ocrText,
      error: `Field validation failed: ${error}`,
      warnings: ["Could not validate extracted fields against schema"],
    };
  }
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
      merged[key as keyof WasteField] = value;
    }
  });

  // Recalculate confidence for corrected fields
  if (merged.confidence) {
    Object.entries(userInput).forEach(([key]) => {
      if (key !== "confidence" && key in merged.confidence) {
        // User-corrected fields get 1.0 confidence
        merged.confidence![key as keyof typeof merged.confidence] = 1.0;
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
