// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { type SummaryRow, subcontractorSummary } from "@/lib/subcontractor/summary";

const NOW = new Date("2026-11-20T09:00:00Z");
const FUTURE = new Date("2026-12-05T00:00:00Z");
const TODAY = new Date("2026-11-20T00:00:00Z");
const YESTERDAY = new Date("2026-11-19T00:00:00Z");
const SENT = new Date("2026-11-01T10:00:00Z");

function row(overrides: Partial<SummaryRow> = {}): SummaryRow {
  return {
    status: "requested",
    dueDate: FUTURE,
    linkSentAt: SENT,
    openedAt: SENT,
    scope1Tco2e: null,
    scope2Tco2e: null,
    scope3Tco2e: null,
    ...overrides,
  };
}

describe("subcontractorSummary: totals", () => {
  it("returns zeros for a contract with no requests", () => {
    expect(subcontractorSummary([], NOW)).toEqual({
      total: 0,
      owed: 0,
      overdue: 0,
      notOpened: 0,
      awaitingReview: 0,
      verified: 0,
      verifiedTco2e: 0,
    });
  });

  it("counts every request in total, whatever its status", () => {
    const rows = [
      row({ status: "requested" }),
      row({ status: "submitted" }),
      row({ status: "verified" }),
      row({ status: "rejected" }),
      row({ status: "overdue" }),
    ];
    expect(subcontractorSummary(rows, NOW).total).toBe(5);
  });
});

describe("subcontractorSummary: owed and overdue", () => {
  it("treats requested, overdue and rejected as owed, since each still wants figures", () => {
    const rows = [
      row({ status: "requested" }),
      row({ status: "overdue" }),
      row({ status: "rejected" }),
      row({ status: "submitted" }),
      row({ status: "verified" }),
    ];
    expect(subcontractorSummary(rows, NOW).owed).toBe(3);
  });

  it("counts a request marked overdue as overdue, even before its due date has passed", () => {
    expect(subcontractorSummary([row({ status: "overdue", dueDate: FUTURE })], NOW).overdue).toBe(1);
  });

  it("counts a still-requested request as overdue once its due day is over", () => {
    expect(subcontractorSummary([row({ status: "requested", dueDate: YESTERDAY })], NOW).overdue).toBe(1);
  });

  it("does not count a request as overdue on its due day, matching the list", () => {
    expect(subcontractorSummary([row({ status: "requested", dueDate: TODAY })], NOW).overdue).toBe(0);
  });

  it("counts a rejected request as overdue only when its due day has passed", () => {
    const rows = [
      row({ status: "rejected", dueDate: YESTERDAY }),
      row({ status: "rejected", dueDate: FUTURE }),
    ];
    expect(subcontractorSummary(rows, NOW).overdue).toBe(1);
  });

  it("never counts submitted or verified requests as overdue, even past due", () => {
    const rows = [
      row({ status: "submitted", dueDate: YESTERDAY }),
      row({ status: "verified", dueDate: YESTERDAY }),
    ];
    const summary = subcontractorSummary(rows, NOW);
    expect(summary.overdue).toBe(0);
    expect(summary.owed).toBe(0);
  });
});

describe("subcontractorSummary: not opened", () => {
  it("counts an owed request whose link went out and was never opened", () => {
    expect(subcontractorSummary([row({ linkSentAt: SENT, openedAt: null })], NOW).notOpened).toBe(1);
  });

  it("does not count a request whose link was opened", () => {
    expect(subcontractorSummary([row({ linkSentAt: SENT, openedAt: SENT })], NOW).notOpened).toBe(0);
  });

  it("does not count a request that has no link yet, since nothing was sent", () => {
    expect(subcontractorSummary([row({ linkSentAt: null, openedAt: null })], NOW).notOpened).toBe(0);
  });

  it("does not count a submitted or verified request, though its link was never opened", () => {
    const rows = [
      row({ status: "submitted", linkSentAt: SENT, openedAt: null }),
      row({ status: "verified", linkSentAt: SENT, openedAt: null }),
    ];
    expect(subcontractorSummary(rows, NOW).notOpened).toBe(0);
  });
});

describe("subcontractorSummary: awaiting review and verified", () => {
  it("counts submitted requests as awaiting review, not owed", () => {
    const summary = subcontractorSummary([row({ status: "submitted" }), row({ status: "submitted" })], NOW);
    expect(summary.awaitingReview).toBe(2);
    expect(summary.owed).toBe(0);
  });

  it("counts verified requests separately and not as owed or awaiting review", () => {
    const summary = subcontractorSummary([row({ status: "verified" })], NOW);
    expect(summary.verified).toBe(1);
    expect(summary.awaitingReview).toBe(0);
    expect(summary.owed).toBe(0);
  });

  it("sums the three scopes of verified requests only, across every value shape Prisma can return", () => {
    const decimal = (value: string) => ({ toString: () => value });
    const rows = [
      row({
        status: "verified",
        scope1Tco2e: decimal("12.5000"),
        scope2Tco2e: decimal("3.2500"),
        scope3Tco2e: decimal("0.2500"),
      }),
      row({ status: "verified", scope1Tco2e: "10", scope2Tco2e: 5, scope3Tco2e: null }),
      // Not verified yet: its figures must not reach the verified total.
      row({ status: "submitted", scope1Tco2e: decimal("999"), scope2Tco2e: "999", scope3Tco2e: 999 }),
      row({ status: "requested", scope1Tco2e: decimal("999") }),
    ];
    const summary = subcontractorSummary(rows, NOW);
    expect(summary.verifiedTco2e).toBe(31);
  });

  it("treats a missing or unreadable scope as zero rather than NaN", () => {
    const rows = [
      row({ status: "verified", scope1Tco2e: "not a number", scope2Tco2e: 4, scope3Tco2e: null }),
    ];
    expect(subcontractorSummary(rows, NOW).verifiedTco2e).toBe(4);
  });

  it("rounds the verified total to four decimal places", () => {
    const rows = [
      row({ status: "verified", scope1Tco2e: "0.33333", scope2Tco2e: "0.00001", scope3Tco2e: "0.00004" }),
    ];
    expect(subcontractorSummary(rows, NOW).verifiedTco2e).toBe(0.3334);
  });
});

describe("subcontractorSummary: a mixed contract", () => {
  it("keeps every bucket separate, so the strip adds up", () => {
    const rows = [
      row({ status: "requested", dueDate: YESTERDAY, linkSentAt: SENT, openedAt: null }),
      row({ status: "overdue", dueDate: YESTERDAY, linkSentAt: SENT, openedAt: SENT }),
      row({ status: "rejected", dueDate: FUTURE, linkSentAt: SENT, openedAt: SENT }),
      row({ status: "submitted", dueDate: FUTURE }),
      row({ status: "verified", dueDate: FUTURE, scope1Tco2e: "2" }),
    ];
    const summary = subcontractorSummary(rows, NOW);
    expect(summary).toEqual({
      total: 5,
      owed: 3,
      overdue: 2,
      notOpened: 1,
      awaitingReview: 1,
      verified: 1,
      verifiedTco2e: 2,
    });
    // Every request is in exactly one of owed, awaiting review, or verified.
    expect(summary.owed + summary.awaitingReview + summary.verified).toBe(summary.total);
  });
});
