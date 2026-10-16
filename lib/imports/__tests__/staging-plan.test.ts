import { describe, expect, it } from "vitest";
import { STAGE_CHUNK_ROWS, nextStageEnd, stageBudgetSpent, stagingStart } from "../staging-plan";

// Rows written, in order, when staging from `cursor` the way the worker does.
function stageFrom(cursor: number, total: number): number[] {
  const written: number[] = [];
  for (let at = cursor; at < total; at = nextStageEnd(at, total)) {
    for (let i = at; i < nextStageEnd(at, total); i++) written.push(i);
  }
  return written;
}

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

describe("staging plan", () => {
  it("stages every row once from a fresh start", () => {
    const total = 2 * STAGE_CHUNK_ROWS + 7;
    expect(stageFrom(0, total)).toEqual(range(0, total));
  });

  it("resumed attempt stages exactly the rows after the cursor", () => {
    const total = 1_234;
    const cursor = nextStageEnd(0, total);
    expect([...range(0, cursor), ...stageFrom(cursor, total)]).toEqual(range(0, total));
  });

  it("stops only after the budget is spent and some rows are staged", () => {
    expect(stageBudgetSpent({ startedAt: 0, now: 40_000, budgetMs: 40_000, madeProgress: true })).toBe(true);
    expect(stageBudgetSpent({ startedAt: 0, now: 40_000, budgetMs: 40_000, madeProgress: false })).toBe(false);
    expect(stageBudgetSpent({ startedAt: 0, now: 999_999, budgetMs: undefined, madeProgress: true })).toBe(false);
  });
});

describe("staging start", () => {
  it("starts over when there is no cursor", () => {
    expect(stagingStart({ cursor: null, storedFingerprint: "f", fingerprint: "f" })).toBe("restart");
  });

  it("resumes a cursor whose reference data is unchanged", () => {
    expect(stagingStart({ cursor: 500, storedFingerprint: "f", fingerprint: "f" })).toBe("resume");
  });

  it("restarts when the reference data changed since the cursor was written", () => {
    expect(stagingStart({ cursor: 500, storedFingerprint: "old", fingerprint: "f" })).toBe("restart");
  });

  it("restarts a cursor written before fingerprints were stored", () => {
    expect(stagingStart({ cursor: 500, storedFingerprint: null, fingerprint: "f" })).toBe("restart");
  });
});
