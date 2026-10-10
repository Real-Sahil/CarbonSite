import { describe, expect, it } from "vitest";
import { AUDIT_RETENTION_YEARS, auditRetentionCutoff } from "../anonymise";

describe("auditRetentionCutoff", () => {
  it("is six years before now", () => {
    expect(AUDIT_RETENTION_YEARS).toBe(6);
    expect(auditRetentionCutoff(new Date("2032-10-12T03:10:00.000Z")).toISOString()).toBe("2026-10-12T03:10:00.000Z");
  });
});
