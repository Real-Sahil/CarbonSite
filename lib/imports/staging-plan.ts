// Resumable staging for an import. Each chunk's rows and the batch's cursor
// (lastProcessedRowIndex, rows staged so far) are written in one transaction, so
// a cursor always matches the rows before it and a later attempt resumes exactly there.

export const STAGE_CHUNK_ROWS = 500;

/** End (exclusive) of the next chunk to stage, starting from `cursor`. */
export function nextStageEnd(cursor: number, total: number): number {
  return Math.min(cursor + STAGE_CHUNK_ROWS, total);
}

/**
 * Whether this invocation should stop before staging another chunk. It never stops
 * before its first chunk, so a slow parse still moves the batch forward.
 */
export function stageBudgetSpent(args: {
  startedAt: number;
  now: number;
  budgetMs?: number;
  madeProgress: boolean;
}): boolean {
  return args.madeProgress && args.budgetMs !== undefined && args.now - args.startedAt >= args.budgetMs;
}

/**
 * Whether staging resumes from the cursor or starts over. Rows after the cursor are
 * validated against the reference data current at that attempt, so a cursor is only
 * trusted when the fingerprint stored with it still matches. No cursor means nothing to trust.
 */
export function stagingStart(args: { cursor: number | null; storedFingerprint: string | null; fingerprint: string }): "resume" | "restart" {
  if (args.cursor == null) return "restart";
  return args.storedFingerprint === args.fingerprint ? "resume" : "restart";
}
