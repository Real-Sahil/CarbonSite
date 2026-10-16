// Time budgets for one invocation of a calculation run (see run-worker.ts).
// Every route that runs a chunk exports maxDuration = 60, the Vercel Hobby limit.
//
// - CHUNK_TIME_BUDGET_MS: one page-load-and-process pass yields after this long.
// - REQUEST_TIME_BUDGET_MS: processCalculationRun starts no new work after this long.
// - FINALIZE_START_BY_MS: finalization (aggregates, Monte Carlo, supplier requests) is
//   not chunked, so it starts only this early in an invocation. Later, it waits for the
//   next invocation, which finds no records left and finalizes from a fresh budget.

export const CHUNK_TIME_BUDGET_MS = 8_000;
export const REQUEST_TIME_BUDGET_MS = 45_000;
export const FINALIZE_START_BY_MS = 20_000;

export function finalizeDeferred(invocationStart: number, now: number): boolean {
  return now - invocationStart >= FINALIZE_START_BY_MS;
}
