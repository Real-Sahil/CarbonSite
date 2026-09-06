-- Support chunked/resumable calculation runs (lib/calculation/run-worker.ts).
-- A single inline-mode calculation run over Tier-1-scale record counts can
-- exceed a serverless function's execution timeout; these columns let a
-- run be processed across multiple bounded invocations instead of one
-- uninterruptible pass, safely resumed by a later invocation if an earlier
-- one didn't finish.

ALTER TABLE "calculation_runs"
  ADD COLUMN "total_record_count" INTEGER,
  ADD COLUMN "processed_record_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_progress_at" TIMESTAMP(3),
  ADD COLUMN "processing_locked_at" TIMESTAMP(3);

-- Guarantees a resumed/re-entered chunk can never double-write a
-- calculation for a record it (or a concurrent chunk) already processed in
-- this run, and backs the "not yet processed" anti-join efficiently.
CREATE UNIQUE INDEX "emission_calculations_calculation_run_id_activity_record_id_key"
  ON "emission_calculations"("calculation_run_id", "activity_record_id");
