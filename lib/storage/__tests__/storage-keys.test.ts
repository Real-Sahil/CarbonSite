import { describe, expect, test } from "vitest";
import {
  assertStorageKey,
  isValidStorageKey,
  keys,
  sanitizeStorageFilename,
} from "../index";

describe("storage key policy", () => {
  test("accepts generated tenant-scoped storage keys", () => {
    expect(isValidStorageKey(keys.evidence("org_123", "ev_123", "ticket.pdf"))).toBe(true);
    expect(isValidStorageKey(keys.importSource("org_123", "imp_123", "csv"))).toBe(true);
    expect(isValidStorageKey(keys.importErrors("org_123", "imp_123"))).toBe(true);
    expect(isValidStorageKey(keys.reportPdf("org_123", "rep_123"))).toBe(true);
    expect(isValidStorageKey(keys.reportCsv("org_123", "rep_123"))).toBe(true);
  });

  test("rejects path traversal and unscoped object keys", () => {
    expect(isValidStorageKey("../secret.txt")).toBe(false);
    expect(isValidStorageKey("/org/org_123/evidence/ev_123/file.pdf")).toBe(false);
    expect(isValidStorageKey("org/org_123/evidence/../file.pdf")).toBe(false);
    expect(isValidStorageKey("org/org_123//evidence/file.pdf")).toBe(false);
    expect(isValidStorageKey("tenant/org_123/evidence/ev_123/file.pdf")).toBe(false);
    expect(() => assertStorageKey("org/org_123/evidence/../file.pdf")).toThrow(
      "Invalid storage key",
    );
  });

  test("sanitizes unsafe evidence filenames", () => {
    expect(sanitizeStorageFilename("../../ticket #1.pdf")).toBe("upload_ticket _1.pdf");
    expect(sanitizeStorageFilename("")).toBe("upload");
    expect(sanitizeStorageFilename("..")).toBe("upload");
  });
});
