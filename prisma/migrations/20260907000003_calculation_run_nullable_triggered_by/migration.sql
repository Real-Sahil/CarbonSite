-- Make triggered_by_user_id nullable on calculation_runs
-- Allows cron-triggered runs (no human actor) to be created without a user ID.
ALTER TABLE "calculation_runs" ALTER COLUMN "triggered_by_user_id" DROP NOT NULL;
