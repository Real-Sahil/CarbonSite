import { describe, it, expect } from "vitest";
import {
  extractWasteFields,
  validateFieldConfidence,
  mergeWithUserCorrections,
  fieldsToCSVRow,
  estimateDataQuality,
  WasteFieldSchema,
} from "../field-extractor";

describe("OCR Pipeline — Field Extraction & Validation", () => {
  describe("extractWasteFields", () => {
    it("extracts structured fields from OCR text", async () => {
      const ocrText = `
        Waste Ticket #12345
        Date: 2024-08-27
        Weight: 50.5 kg
        EWC Code: 150110
        Supplier: ABC Waste Management
        Facility: Regional Landfill
        Vehicle Reg: AB21 CDE
      `;

      const result = await extractWasteFields(ocrText);

      expect(result.status).toBe("success");
      expect(result.fields.weight).toBe(50.5);
      expect(result.fields.ewcCode).toBe("150110");
      expect(result.fields.supplier).toContain("ABC");
      expect(result.extractedFieldsCount).toBeGreaterThan(0);
    });

    it("includes confidence scores for each field", async () => {
      const ocrText = "Weight: 25 kg, EWC: 160120, Date: 2024-08-27";

      const result = await extractWasteFields(ocrText);

      expect(result.fields.confidence).toBeDefined();
      expect(result.fields.confidence?.weight).toBeGreaterThan(0);
      expect(result.fields.confidence?.ewcCode).toBeGreaterThan(0);
      expect(result.fields.confidence?.date).toBeGreaterThan(0);
    });

    it("handles partial extraction gracefully", async () => {
      const ocrText = "Only has weight: 100 kg";

      const result = await extractWasteFields(ocrText);

      expect(result.status).toMatch(/success|partial/);
      expect(result.fields.weight).toBeDefined();
      expect(result.extractedFieldsCount).toBeGreaterThanOrEqual(1);
    });

    it("returns error for empty OCR text", async () => {
      const result = await extractWasteFields("");

      expect(result.status).toBe("error");
      expect(result.error).toBeTruthy();
      expect(result.extractedFieldsCount).toBe(0);
    });
  });

  describe("validateFieldConfidence", () => {
    it("identifies high-confidence extractions", () => {
      const fields = {
        weight: 50,
        ewcCode: "150110",
        date: new Date().toISOString(),
        supplier: "Supplier",
        facility: "Facility",
        vehicleReg: "REG123",
        confidence: {
          weight: 0.95,
          ewcCode: 0.92,
          date: 0.90,
          supplier: 0.88,
          facility: 0.91,
          vehicleReg: 0.89,
        },
      };

      const validation = validateFieldConfidence(fields, 0.8);

      expect(validation.isConfident).toBe(true);
      expect(validation.lowConfidenceFields).toHaveLength(0);
      expect(validation.avgConfidence).toBeGreaterThan(0.85);
    });

    it("flags low-confidence fields", () => {
      const fields = {
        weight: 50,
        ewcCode: "150110",
        confidence: {
          weight: 0.95,
          ewcCode: 0.45, // Below threshold
          date: 0.3, // Below threshold
          supplier: 0.85,
          facility: 0.88,
          vehicleReg: 0.92,
        },
      };

      const validation = validateFieldConfidence(fields, 0.8);

      expect(validation.isConfident).toBe(false);
      expect(validation.lowConfidenceFields).toContain("ewcCode");
      expect(validation.lowConfidenceFields).toContain("date");
      expect(validation.lowConfidenceFields.length).toBe(2);
    });

    it("calculates average confidence correctly", () => {
      const fields = {
        weight: 50,
        confidence: {
          weight: 0.8,
          ewcCode: 0.6,
          date: 1.0,
          supplier: 0.4,
          facility: 0.8,
          vehicleReg: 0.4,
        },
      };

      const validation = validateFieldConfidence(fields);

      const expected = (0.8 + 0.6 + 1.0 + 0.4 + 0.8 + 0.4) / 6;
      expect(validation.avgConfidence).toBeCloseTo(expected, 2);
    });
  });

  describe("mergeWithUserCorrections", () => {
    it("applies user corrections to extracted fields", () => {
      const extracted = {
        weight: 50,
        ewcCode: "150110",
        supplier: "Wrong Supplier",
        date: "2024-08-27T00:00:00Z",
      };

      const userInput = {
        supplier: "Correct Supplier",
        facility: "New Facility",
      };

      const merged = mergeWithUserCorrections(extracted, userInput);

      expect(merged.weight).toBe(50);
      expect(merged.ewcCode).toBe("150110");
      expect(merged.supplier).toBe("Correct Supplier");
      expect(merged.facility).toBe("New Facility");
      expect(merged.date).toBe("2024-08-27T00:00:00Z");
    });

    it("resets confidence for user-corrected fields", () => {
      const extracted = {
        weight: 50,
        ewcCode: "150110",
        confidence: {
          weight: 0.9,
          ewcCode: 0.5, // Low confidence
          date: 0.8,
          supplier: 0.7,
          facility: 0.6,
          vehicleReg: 0.85,
        },
      };

      const userInput = {
        ewcCode: "160120", // User corrected the low-confidence field
      };

      const merged = mergeWithUserCorrections(extracted, userInput);

      expect(merged.ewcCode).toBe("160120");
      expect(merged.confidence?.ewcCode).toBe(1.0); // Corrected field gets full confidence
      expect(merged.confidence?.weight).toBe(0.9); // Original unchanged
    });
  });

  describe("fieldsToCSVRow", () => {
    it("exports fields as valid CSV row", () => {
      const fields = {
        date: "2024-08-27",
        supplier: "ABC Waste",
        facility: "Landfill Site",
        weight: 50.5,
        ewcCode: "150110",
        vehicleReg: "AB21 CDE",
        notes: "Standard waste",
      };

      const csv = fieldsToCSVRow(fields);

      expect(csv).toContain("2024-08-27");
      expect(csv).toContain("ABC Waste");
      expect(csv).toContain("50.5");
      expect(csv).toContain("150110");
    });

    it("properly escapes quotes in CSV", () => {
      const fields = {
        supplier: 'Company with "quotes"',
        notes: 'Note with "special" characters',
      };

      const csv = fieldsToCSVRow(fields);

      expect(csv).toContain('""quotes""');
      expect(csv).toContain('""special""');
    });
  });

  describe("estimateDataQuality", () => {
    it("rates high-quality data with all fields", () => {
      const fields = {
        weight: 50.5,
        ewcCode: "150110",
        date: new Date().toISOString(),
        supplier: "Supplier",
        facility: "Facility",
        vehicleReg: "REG123",
        confidence: {
          weight: 0.95,
          ewcCode: 0.92,
          date: 0.90,
          supplier: 0.88,
          facility: 0.91,
          vehicleReg: 0.89,
        },
      };

      const quality = estimateDataQuality(fields);

      expect(quality.quality).toBe("high");
      expect(quality.score).toBeGreaterThan(75);
      expect(quality.feedback).toHaveLength(0);
    });

    it("flags missing critical fields", () => {
      const fields = {
        weight: 50,
        // Missing ewcCode and date
        supplier: "Supplier",
      };

      const quality = estimateDataQuality(fields);

      expect(quality.quality).toMatch(/medium|low/);
      expect(quality.feedback.some((f) => f.includes("critical"))).toBe(true);
    });

    it("rates medium quality with partial data", () => {
      const fields = {
        weight: 50,
        ewcCode: "150110",
        date: new Date().toISOString(),
        // Missing supplier and facility
        confidence: {
          weight: 0.8,
          ewcCode: 0.75,
          date: 0.8,
          supplier: 0,
          facility: 0,
          vehicleReg: 0,
        },
      };

      const quality = estimateDataQuality(fields);

      expect(["medium", "low"]).toContain(quality.quality);
      expect(quality.feedback.length).toBeGreaterThan(0);
    });

    it("warns on low OCR confidence", () => {
      const fields = {
        weight: 50,
        ewcCode: "150110",
        date: new Date().toISOString(),
        confidence: {
          weight: 0.4,
          ewcCode: 0.3,
          date: 0.35,
          supplier: 0.2,
          facility: 0.25,
          vehicleReg: 0.3,
        },
      };

      const quality = estimateDataQuality(fields);

      expect(quality.quality).toBe("low");
      expect(quality.feedback.some((f) => f.includes("Low OCR confidence"))).toBe(true);
    });
  });

  describe("WasteFieldSchema validation", () => {
    it("validates valid waste fields", () => {
      const validField = {
        weight: 50.5,
        ewcCode: "150110",
        date: new Date().toISOString(),
        supplier: "Test Supplier",
        facility: "Test Facility",
        vehicleReg: "AB21 CDE",
        notes: "Test notes",
        confidence: {
          weight: 0.95,
          ewcCode: 0.92,
          date: 0.90,
          supplier: 0.88,
          facility: 0.91,
          vehicleReg: 0.89,
        },
      };

      expect(() => WasteFieldSchema.parse(validField)).not.toThrow();
    });

    it("rejects invalid EWC codes", () => {
      const invalidField = {
        ewcCode: "12345", // Only 5 digits, needs 6
      };

      expect(() => WasteFieldSchema.parse(invalidField)).toThrow();
    });

    it("rejects negative weight", () => {
      const invalidField = {
        weight: -10,
      };

      expect(() => WasteFieldSchema.parse(invalidField)).toThrow();
    });

    it("allows partial fields (optional)", () => {
      const partial = {
        weight: 50.5,
        // Other fields optional
      };

      expect(() => WasteFieldSchema.parse(partial)).not.toThrow();
    });
  });

  describe("End-to-End OCR + Extraction Workflow", () => {
    it("simulates full field capture workflow", async () => {
      // 1. OCR text from image
      const ocrText = `
        WASTE DISPOSAL TICKET
        Date: 27/08/2024
        Weight: 125.5 kg
        EWC Code: 190301
        Transport: ABC Logistics
        Destination: Central Landfill Site
        Vehicle: AB21CDE
        Notes: Mixed construction waste
      `;

      // 2. Extract fields
      const extracted = await extractWasteFields(ocrText);
      expect(extracted.status).toMatch(/success|partial/);

      // 3. Validate confidence
      const confidence = validateFieldConfidence(extracted.fields, 0.8);
      expect(confidence.avgConfidence).toBeGreaterThan(0);

      // 4. User reviews and corrects low-confidence fields
      const userCorrections = {
        weight: 120.5, // Corrected manually
      };
      const reviewed = mergeWithUserCorrections(extracted.fields, userCorrections);
      expect(reviewed.weight).toBe(120.5);

      // 5. Estimate final quality
      const quality = estimateDataQuality(reviewed);
      expect(quality.score).toBeGreaterThanOrEqual(0);
      expect(quality.quality).toMatch(/high|medium|low/);

      // 6. Export as CSV
      const csv = fieldsToCSVRow(reviewed);
      expect(csv).toContain("120.5");
    });
  });
});
