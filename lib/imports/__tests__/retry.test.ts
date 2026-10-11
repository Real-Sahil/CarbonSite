import { describe, expect, it } from "vitest";
import { IMPORT_STALE_MS, MAX_IMPORT_ATTEMPTS, attemptsExhausted, decideStalledImport } from "../retry";

const now = new Date("2026-10-14T12:00:00Z");
const quietFor = (ms: number) => new Date(now.getTime() - ms);

describe("decideStalledImport", () => {
  it("leaves a batch alone while its parse is still making progress", () => {
    expect(decideStalledImport({ state: "parsing", processingAttempts: 1, updatedAt: quietFor(IMPORT_STALE_MS - 1) }, now)).toBe("skip");
  });

  it("retries a stalled batch while attempts remain", () => {
    expect(decideStalledImport({ state: "parsing", processingAttempts: 1, updatedAt: quietFor(IMPORT_STALE_MS) }, now)).toBe("retry");
    expect(decideStalledImport({ state: "parsing", processingAttempts: MAX_IMPORT_ATTEMPTS - 1, updatedAt: quietFor(IMPORT_STALE_MS * 2) }, now)).toBe("retry");
  });

  it("fails a stalled batch once every attempt has been used", () => {
    expect(decideStalledImport({ state: "parsing", processingAttempts: MAX_IMPORT_ATTEMPTS, updatedAt: quietFor(IMPORT_STALE_MS) }, now)).toBe("fail");
  });

  it("never touches a batch that is not parsing", () => {
    for (const state of ["uploaded", "ready_to_commit", "needs_attention", "failed", "committed"]) {
      expect(decideStalledImport({ state, processingAttempts: 1, updatedAt: quietFor(IMPORT_STALE_MS * 10) }, now)).toBe("skip");
    }
  });

  it("allows exactly MAX_IMPORT_ATTEMPTS starts in total", () => {
    expect(attemptsExhausted(MAX_IMPORT_ATTEMPTS - 1)).toBe(false);
    expect(attemptsExhausted(MAX_IMPORT_ATTEMPTS)).toBe(true);
    expect(MAX_IMPORT_ATTEMPTS).toBe(3);
  });
});
