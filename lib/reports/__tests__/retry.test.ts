import { describe, expect, it } from "vitest";
import { MAX_REPORT_ATTEMPTS, REPORT_STALE_MS, decideStalledReport, reportAttemptsExhausted } from "../retry";

const now = new Date("2026-10-15T12:00:00Z");
const quietFor = (ms: number) => new Date(now.getTime() - ms);

describe("decideStalledReport", () => {
  it("leaves a report alone while its render may still be running", () => {
    expect(decideStalledReport({ status: "generating", processingAttempts: 1, updatedAt: quietFor(REPORT_STALE_MS - 1) }, now)).toBe("skip");
  });

  it("retries a stalled queued or generating report while attempts remain", () => {
    expect(decideStalledReport({ status: "queued", processingAttempts: 0, updatedAt: quietFor(REPORT_STALE_MS) }, now)).toBe("retry");
    expect(decideStalledReport({ status: "generating", processingAttempts: MAX_REPORT_ATTEMPTS - 1, updatedAt: quietFor(REPORT_STALE_MS * 2) }, now)).toBe("retry");
  });

  it("fails a stalled report once every attempt has been used", () => {
    expect(decideStalledReport({ status: "generating", processingAttempts: MAX_REPORT_ATTEMPTS, updatedAt: quietFor(REPORT_STALE_MS) }, now)).toBe("fail");
  });

  it("never touches a report that has finished or failed on its own", () => {
    for (const status of ["ready", "failed"]) {
      expect(decideStalledReport({ status, processingAttempts: 1, updatedAt: quietFor(REPORT_STALE_MS * 10) }, now)).toBe("skip");
    }
  });

  it("allows exactly MAX_REPORT_ATTEMPTS starts in total", () => {
    expect(reportAttemptsExhausted(MAX_REPORT_ATTEMPTS - 1)).toBe(false);
    expect(reportAttemptsExhausted(MAX_REPORT_ATTEMPTS)).toBe(true);
    expect(MAX_REPORT_ATTEMPTS).toBe(3);
  });
});
