-- Create dbt_runs if not exists (handles fresh database installs)
CREATE TABLE IF NOT EXISTS "dbt_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "calculation_run_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "models_executed" INTEGER,
    "tests_run" INTEGER,
    "tests_passed" INTEGER,
    "tests_failed" INTEGER,
    "output" TEXT,
    "error_message" TEXT,
    "duration_seconds" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dbt_runs_pkey" PRIMARY KEY ("id")
);

-- AlterTable "dbt_runs" to match schema (safe on both fresh and existing DBs)
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "dbt_command";
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "dbt_output";
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "rows_affected";
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "models_created";
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "test_count";
ALTER TABLE "dbt_runs" DROP COLUMN IF EXISTS "duration";

-- Add missing columns with correct names
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "models_executed" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "tests_run" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "tests_passed" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "tests_failed" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "output" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "duration_seconds" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Alter status column to ensure correct default
ALTER TABLE "dbt_runs" ALTER COLUMN "status" SET DEFAULT 'queued';

-- Add foreign key constraints if not exist
ALTER TABLE "dbt_runs" DROP CONSTRAINT IF EXISTS "dbt_runs_calculation_run_id_fkey";
ALTER TABLE "dbt_runs" DROP CONSTRAINT IF EXISTS "dbt_runs_organization_id_fkey";
ALTER TABLE "dbt_runs" DROP CONSTRAINT IF EXISTS "dbt_runs_organization_id_calculation_run_id_key";

DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_calculation_run_id_fkey" FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add unique constraint
DO $$
BEGIN
  ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_organization_id_calculation_run_id_key" UNIQUE ("organization_id", "calculation_run_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Recreate indexes
DROP INDEX IF EXISTS "dbt_runs_organization_id_status_idx";
DROP INDEX IF EXISTS "dbt_runs_organization_id_created_at_idx";

CREATE INDEX IF NOT EXISTS "dbt_runs_organization_id_status_idx" ON "dbt_runs"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "dbt_runs_organization_id_created_at_idx" ON "dbt_runs"("organization_id", "created_at" DESC);
