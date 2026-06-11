import { describe, expect, test } from "vitest";
import {
  EVIDENCE_MAX_BYTES,
  isAllowedEvidenceMimeType,
  isAllowedEvidenceSize,
  normalizeMimeType,
} from "../upload-policy";

describe("evidence upload policy", () => {
  test("normalizes MIME type parameters", () => {
    expect(normalizeMimeType("Image/JPEG; charset=binary")).toBe("image/jpeg");
  });

  test("allows evidence document and image formats", () => {
    expect(isAllowedEvidenceMimeType("application/pdf")).toBe(true);
    expect(isAllowedEvidenceMimeType("image/png")).toBe(true);
    expect(isAllowedEvidenceMimeType("text/csv")).toBe(true);
  });

  test("rejects executable or unknown uploads", () => {
    expect(isAllowedEvidenceMimeType("application/x-msdownload")).toBe(false);
    expect(isAllowedEvidenceMimeType("application/octet-stream")).toBe(false);
  });

  test("enforces byte-size bounds", () => {
    expect(isAllowedEvidenceSize(1)).toBe(true);
    expect(isAllowedEvidenceSize(EVIDENCE_MAX_BYTES)).toBe(true);
    expect(isAllowedEvidenceSize(0)).toBe(false);
    expect(isAllowedEvidenceSize(EVIDENCE_MAX_BYTES + 1)).toBe(false);
  });
});
