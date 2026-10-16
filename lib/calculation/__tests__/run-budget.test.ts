import { describe, expect, it } from "vitest";
import { FINALIZE_START_BY_MS, REQUEST_TIME_BUDGET_MS, finalizeDeferred } from "../run-budget";

describe("finalizeDeferred", () => {
  const start = 1_000_000;

  it("starts finalization early in an invocation", () => {
    expect(finalizeDeferred(start, start)).toBe(false);
    expect(finalizeDeferred(start, start + FINALIZE_START_BY_MS - 1)).toBe(false);
  });

  it("defers finalization to a fresh invocation once the budget is mostly spent", () => {
    expect(finalizeDeferred(start, start + FINALIZE_START_BY_MS)).toBe(true);
  });

  it("keeps finalization start inside the page budget inside a 60 s function", () => {
    expect(FINALIZE_START_BY_MS).toBeLessThan(REQUEST_TIME_BUDGET_MS);
    expect(REQUEST_TIME_BUDGET_MS).toBeLessThan(60_000);
  });
});
