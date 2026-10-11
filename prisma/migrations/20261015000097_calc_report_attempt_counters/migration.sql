-- Attempt counters for stalled work. A calculation run whose invocation dies
-- mid-chunk is reclaimed by the stalled-run sweep, and fails once
-- interrupted_attempts reaches MAX_INTERRUPTED_ATTEMPTS (lib/calculation/run-worker.ts).
-- A report killed mid-render is started again by the reports sweep up to
-- MAX_REPORT_ATTEMPTS (lib/reports/retry.ts).
-- Additive with defaults, so the previous release, which never reads them, keeps working.

-- AlterTable
ALTER TABLE "calculation_runs" ADD COLUMN     "interrupted_attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "processing_attempts" INTEGER NOT NULL DEFAULT 0;
