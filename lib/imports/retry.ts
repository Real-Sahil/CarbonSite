// Retry policy for import parsing. On a Vercel-only deployment the parse runs
// inside the request that uploaded the file (JOB_PROCESSING_MODE=inline), so a
// function timeout or a transient failure leaves the batch in "parsing" with no
// worker to pick it up. The import-batches sweep finds such batches once they
// have been quiet for IMPORT_STALE_MS and parses them again, up to
// MAX_IMPORT_ATTEMPTS counted starts. A yield that kept its progress is refunded
// by the worker (lib/imports/worker.ts), so only stalls, failures and restarts that
// discarded staged rows count.

/** Counted starts allowed per batch (CLAUDE.md: 3 attempts). */
export const MAX_IMPORT_ATTEMPTS = 3;

/**
 * How long a parsing batch may go without a write before it counts as stalled.
 * updatedAt moves at the start of each attempt and after every staged chunk, and
 * one invocation stops staging well inside 60 s, so a live parse is never this
 * quiet. A batch left part-staged resumes from its cursor once this has passed.
 */
export const IMPORT_STALE_MS = 3 * 60_000;

export type ImportSweepDecision = "skip" | "retry" | "fail";

export function attemptsExhausted(processingAttempts: number): boolean {
  return processingAttempts >= MAX_IMPORT_ATTEMPTS;
}

/** What the sweep does with one batch it found in "parsing". */
export function decideStalledImport(
  batch: { state: string; processingAttempts: number; updatedAt: Date },
  now: Date,
): ImportSweepDecision {
  if (batch.state !== "parsing") return "skip";
  if (now.getTime() - batch.updatedAt.getTime() < IMPORT_STALE_MS) return "skip";
  return attemptsExhausted(batch.processingAttempts) ? "fail" : "retry";
}
