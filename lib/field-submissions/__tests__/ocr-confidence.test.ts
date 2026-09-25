import { describe, expect, it } from "vitest";
import { ocrFieldChecks, sanitiseOcrConfidence } from "../ocr-confidence";

describe("OCR confidence", () => {
  it("keeps only named fields with a 0-1 score", () => {
    expect(sanitiseOcrConfidence({ weight: 0.9, date: "0.4", bad: 3, "x y": 0.5, supplierName: null })).toEqual({ weight: 0.9, date: 0.4 });
    expect(sanitiseOcrConfidence([0.5])).toBeNull();
    expect(sanitiseOcrConfidence({})).toBeNull();
  });

  it("puts low-confidence fields first, then edited ones", () => {
    const rows = ocrFieldChecks(
      { weight: "12.4", ewcCode: "170504", date: "2025-03-01", __confidence: { weight: 0.95, ewcCode: 0.4, date: 0.7 } },
      { weight: "12.4", ewcCode: "170504", date: "2025-03-02", vehicleReg: "AB12 CDE", autoExtracted: ["weight"] },
      new Set(["autoExtracted"]),
    );
    expect(rows.map((r) => [r.key, r.low, r.edited])).toEqual([
      ["ewcCode", true, false],
      ["date", false, true],
      ["weight", false, false],
      ["vehicleReg", false, false],
    ]);
    expect(rows.find((r) => r.key === "vehicleReg")!.confidence).toBeNull();
  });
});
