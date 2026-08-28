-- CreateTable dbt_runs
CREATE TABLE "dbt_runs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "calculation_run_id" TEXT,
  "status" TEXT NOT NULL,
  "dbt_version" TEXT,
  "output" TEXT,
  "rows_affected" INTEGER,
  "model_count" INTEGER,
  "test_count" INTEGER,
  "tests_passed" INTEGER,
  "tests_failed" INTEGER,
  "error_message" TEXT,
  "error_details" JSONB,
  "duration" INTEGER,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dbt_runs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX "dbt_runs_organization_calculation_idx" ON "dbt_runs"("organization_id", "calculation_run_id");
CREATE INDEX "dbt_runs_organization_status_idx" ON "dbt_runs"("organization_id", "status", "created_at" DESC);

-- Add foreign key constraints
ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_calculation_run_id_fkey"
  FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
