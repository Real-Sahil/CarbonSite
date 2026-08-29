-- AlterTable "dbt_runs" to match schema
-- Drop old columns and rename, add new ones
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "dbt_command";
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "dbt_output";
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "rows_affected";
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "models_created";
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "test_count";
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "duration";

-- Add missing columns with correct names
ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "models_executed" INTEGER;
ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "tests_run" INTEGER;
ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "tests_passed" INTEGER;
ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "tests_failed" INTEGER;
ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "output" TEXT;
ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "duration_seconds" INTEGER;
ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);
ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Alter status column to ensure correct default
ALTER TABLE "dbt_runs" ALTER COLUMN "status" SET DEFAULT 'queued';

-- Add foreign key constraints if not exist
ALTER TABLE "dbt_runs" DROP CONSTRAINT IF EXISTS "dbt_runs_calculation_run_id_fkey";
ALTER TABLE "dbt_runs" DROP CONSTRAINT IF EXISTS "dbt_runs_organization_id_fkey";

ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_calculation_run_id_fkey" FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE CASCADE;

-- Add unique constraint
ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_organization_id_calculation_run_id_key" UNIQUE ("organization_id", "calculation_run_id");

-- Recreate indexes
DROP INDEX IF EXISTS "dbt_runs_organization_id_status_idx";
DROP INDEX IF EXISTS "dbt_runs_organization_id_created_at_idx";

CREATE INDEX "dbt_runs_organization_id_status_idx" ON "dbt_runs"("organization_id", "status");
CREATE INDEX "dbt_runs_organization_id_created_at_idx" ON "dbt_runs"("organization_id", "created_at" DESC);
