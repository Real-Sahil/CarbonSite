-- CreateEnum for BulkOperationType
DO $$ BEGIN
  CREATE TYPE "bulk_operation_type" AS ENUM ('review', 'categorize', 'export', 'calculate', 'delete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum for BulkOperationStatus
DO $$ BEGIN
  CREATE TYPE "bulk_operation_status" AS ENUM ('queued', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum for CalculationScheduleFrequency
DO $$ BEGIN
  CREATE TYPE "calculation_schedule_frequency" AS ENUM ('manual', 'weekly', 'monthly', 'quarterly', 'annually');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum for DigestFrequency
DO $$ BEGIN
  CREATE TYPE "digest_frequency" AS ENUM ('daily', 'weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable BulkOperation
CREATE TABLE IF NOT EXISTS "bulk_operations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operation_type" "bulk_operation_type" NOT NULL,
    "status" "bulk_operation_status" NOT NULL DEFAULT 'queued',
    "total_count" INTEGER NOT NULL,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "record_ids" TEXT[] NOT NULL,
    "parameters" JSONB NOT NULL,
    "errors" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable CalculationSchedule
CREATE TABLE IF NOT EXISTS "calculation_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "calculation_schedule_frequency" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "day_of_week" INTEGER,
    "day_of_month" INTEGER,
    "quarter_month" INTEGER,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculation_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable DigestPreference
CREATE TABLE IF NOT EXISTS "digest_preferences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "digest_frequency" NOT NULL DEFAULT 'weekly',
    "day_of_week" INTEGER,
    "day_of_month" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digest_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectRoleAssignment
CREATE TABLE IF NOT EXISTS "project_role_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "assigned_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bulk_operations_organization_id_status_idx" ON "bulk_operations"("organization_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bulk_operations_organization_id_operation_type_idx" ON "bulk_operations"("organization_id", "operation_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bulk_operations_created_at_idx" ON "bulk_operations"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "calculation_schedules_organization_id_enabled_idx" ON "calculation_schedules"("organization_id", "enabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "calculation_schedules_organization_id_next_run_at_idx" ON "calculation_schedules"("organization_id", "next_run_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "digest_preferences_organization_id_enabled_idx" ON "digest_preferences"("organization_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "digest_preferences_organization_id_user_id_key" ON "digest_preferences"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_role_assignments_user_id_project_id_key" ON "project_role_assignments"("user_id", "project_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_role_assignments_organization_id_project_id_idx" ON "project_role_assignments"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_role_assignments_user_id_idx" ON "project_role_assignments"("user_id");

-- AddForeignKey
ALTER TABLE "bulk_operations" DROP CONSTRAINT IF EXISTS "bulk_operations_organization_id_fkey";
DO $$
BEGIN
  ALTER TABLE "bulk_operations" ADD CONSTRAINT "bulk_operations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
ALTER TABLE "calculation_schedules" DROP CONSTRAINT IF EXISTS "calculation_schedules_organization_id_fkey";
DO $$
BEGIN
  ALTER TABLE "calculation_schedules" ADD CONSTRAINT "calculation_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
ALTER TABLE "calculation_schedules" DROP CONSTRAINT IF EXISTS "calculation_schedules_reporting_period_id_fkey";
DO $$
BEGIN
  ALTER TABLE "calculation_schedules" ADD CONSTRAINT "calculation_schedules_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
ALTER TABLE "digest_preferences" DROP CONSTRAINT IF EXISTS "digest_preferences_organization_id_fkey";
DO $$
BEGIN
  ALTER TABLE "digest_preferences" ADD CONSTRAINT "digest_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
ALTER TABLE "project_role_assignments" DROP CONSTRAINT IF EXISTS "project_role_assignments_organization_id_fkey";
DO $$
BEGIN
  ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
ALTER TABLE "project_role_assignments" DROP CONSTRAINT IF EXISTS "project_role_assignments_user_id_fkey";
DO $$
BEGIN
  ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
ALTER TABLE "project_role_assignments" DROP CONSTRAINT IF EXISTS "project_role_assignments_project_id_fkey";
DO $$
BEGIN
  ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
ALTER TABLE "project_role_assignments" DROP CONSTRAINT IF EXISTS "project_role_assignments_assigned_by_user_id_fkey";
DO $$
BEGIN
  ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
