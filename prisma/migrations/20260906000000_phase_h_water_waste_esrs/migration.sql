-- Phase H: Water & Waste as first-class categories (CSRD ESRS E3 / E5).
--
-- WaterRecord is new and stays entirely outside ActivityRecord/
-- EmissionCalculation: water withdrawal/discharge/consumption has no GHG
-- Protocol scope, so it never drives a CO2e calculation.
--
-- WasteRecord (previously a disconnected "Phase 6" side table linking only
-- to Project, with its own hardcoded DEFRA factor table duplicated three
-- times across the codebase) is extended in place: facility_id,
-- reporting_period_id, hazardous, activity_record_id and data_source are
-- added so it can link into the real calculation engine (via a created
-- ActivityRecord in the existing s3-waste category) instead of computing
-- its own CO2e. The new columns are nullable for now; a follow-up backfill
-- migration tightens facility_id/reporting_period_id to NOT NULL once
-- existing rows have been assigned a facility/period and linked
-- ActivityRecord.
--
-- EnvironmentalMetricAggregate is a new table parallel to
-- DashboardAggregate (not bolted onto it - DashboardAggregate.totalCo2e is
-- a non-nullable column literally named for CO2e) holding facility/period
-- rollups for water and waste physical quantities (m3, tonnes).
--
-- DataCompletenessRequirement gets TWO separate compound uniques, not one
-- spanning both new nullable columns: Postgres unique indexes never treat
-- NULL as equal to NULL, so a single (..., emission_category_id,
-- metric_type) key would silently stop enforcing uniqueness for every GHG
-- row (metric_type always null there). Each constraint below only
-- "activates" for the row kind whose key column is actually populated.
--
-- Also: esrs_e3/esrs_e5 added to SupportedFramework (compliance crosswalk),
-- csrd_esrs_e3/csrd_esrs_e5 added to report_type, water_meter_reading added
-- to field_document_type (mobile field capture), and AssuranceSample /
-- AssuranceFinding extended with nullable generic fields so assurance
-- sampling and findings can cover non-GHG metrics without touching any
-- existing GHG-only row.

-- CreateEnum
CREATE TYPE "water_metric_type" AS ENUM ('withdrawal', 'discharge', 'consumption');

-- CreateEnum
CREATE TYPE "water_source" AS ENUM ('municipal_supply', 'groundwater', 'surface_water', 'rainwater_harvested', 'recycled_reused', 'third_party_wastewater', 'other');

-- CreateEnum
CREATE TYPE "water_stress_level" AS ENUM ('low', 'medium_high', 'high', 'extremely_high', 'unknown');

-- CreateEnum
CREATE TYPE "environmental_data_source" AS ENUM ('manual', 'import', 'field_submission', 'iot_meter');

-- CreateEnum
CREATE TYPE "environmental_metric_type" AS ENUM ('water_withdrawal', 'water_discharge', 'water_consumption', 'waste_generated', 'waste_diverted', 'waste_hazardous');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SupportedFramework" ADD VALUE 'esrs_e3';
ALTER TYPE "SupportedFramework" ADD VALUE 'esrs_e5';

-- AlterEnum
ALTER TYPE "field_document_type" ADD VALUE 'water_meter_reading';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "report_type" ADD VALUE 'csrd_esrs_e3';
ALTER TYPE "report_type" ADD VALUE 'csrd_esrs_e5';

-- AlterTable
ALTER TABLE "analytics_dashboard_cache" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';

-- AlterTable
ALTER TABLE "assurance_findings" ADD COLUMN     "quantified_impact_unit" TEXT,
ADD COLUMN     "quantified_impact_value" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "assurance_samples" ADD COLUMN     "waste_record_id" TEXT,
ADD COLUMN     "water_record_id" TEXT;

-- AlterTable
ALTER TABLE "data_completeness_requirements" ADD COLUMN     "metric_type" "environmental_metric_type",
ALTER COLUMN "emission_category_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN     "water_stress_assessed_at" TIMESTAMP(3),
ADD COLUMN     "water_stress_level" "water_stress_level",
ADD COLUMN     "water_stress_source" TEXT;

-- AlterTable
ALTER TABLE "waste_records" ADD COLUMN     "activity_record_id" TEXT,
ADD COLUMN     "created_by_user_id" TEXT,
ADD COLUMN     "data_source" "environmental_data_source" NOT NULL DEFAULT 'manual',
ADD COLUMN     "facility_id" TEXT,
ADD COLUMN     "field_submission_id" TEXT,
ADD COLUMN     "hazardous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reporting_period_id" TEXT;

-- CreateTable
CREATE TABLE "water_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "metric_type" "water_metric_type" NOT NULL,
    "source" "water_source" NOT NULL DEFAULT 'other',
    "volume_m3" DECIMAL(15,4) NOT NULL,
    "is_water_stressed_area" BOOLEAN NOT NULL DEFAULT false,
    "data_source" "environmental_data_source" NOT NULL DEFAULT 'manual',
    "field_submission_id" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "water_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environmental_metric_aggregates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "snapshot_id" TEXT,
    "metric_type" "environmental_metric_type" NOT NULL,
    "facility_id" TEXT,
    "business_unit_id" TEXT,
    "total_value" DECIMAL(18,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "record_count" INTEGER NOT NULL,
    "intensity_per_revenue_unit" DECIMAL(18,8),
    "intensity_per_fte" DECIMAL(18,8),
    "intensity_per_m2" DECIMAL(18,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "environmental_metric_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "water_records_organization_id_facility_id_recorded_at_idx" ON "water_records"("organization_id", "facility_id", "recorded_at");

-- CreateIndex
CREATE INDEX "water_records_organization_id_reporting_period_id_metric_ty_idx" ON "water_records"("organization_id", "reporting_period_id", "metric_type");

-- CreateIndex
CREATE INDEX "environmental_metric_aggregates_organization_id_reporting_p_idx" ON "environmental_metric_aggregates"("organization_id", "reporting_period_id", "snapshot_id");

-- CreateIndex
CREATE INDEX "environmental_metric_aggregates_organization_id_snapshot_id_idx" ON "environmental_metric_aggregates"("organization_id", "snapshot_id", "metric_type");

-- CreateIndex
CREATE UNIQUE INDEX "completeness_req_org_facility_metric_key" ON "data_completeness_requirements"("organization_id", "facility_id", "metric_type");

-- CreateIndex
CREATE UNIQUE INDEX "waste_records_activity_record_id_key" ON "waste_records"("activity_record_id");

-- CreateIndex
CREATE INDEX "waste_records_organization_id_facility_id_recorded_at_idx" ON "waste_records"("organization_id", "facility_id", "recorded_at");

-- CreateIndex
CREATE INDEX "waste_records_organization_id_reporting_period_id_idx" ON "waste_records"("organization_id", "reporting_period_id");

-- AddForeignKey
ALTER TABLE "water_records" ADD CONSTRAINT "water_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_records" ADD CONSTRAINT "water_records_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_records" ADD CONSTRAINT "water_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_records" ADD CONSTRAINT "water_records_field_submission_id_fkey" FOREIGN KEY ("field_submission_id") REFERENCES "field_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_records" ADD CONSTRAINT "water_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_activity_record_id_fkey" FOREIGN KEY ("activity_record_id") REFERENCES "activity_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_field_submission_id_fkey" FOREIGN KEY ("field_submission_id") REFERENCES "field_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_metric_aggregates" ADD CONSTRAINT "environmental_metric_aggregates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_metric_aggregates" ADD CONSTRAINT "environmental_metric_aggregates_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_metric_aggregates" ADD CONSTRAINT "environmental_metric_aggregates_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "published_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_metric_aggregates" ADD CONSTRAINT "environmental_metric_aggregates_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_metric_aggregates" ADD CONSTRAINT "environmental_metric_aggregates_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurance_samples" ADD CONSTRAINT "assurance_samples_water_record_id_fkey" FOREIGN KEY ("water_record_id") REFERENCES "water_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurance_samples" ADD CONSTRAINT "assurance_samples_waste_record_id_fkey" FOREIGN KEY ("waste_record_id") REFERENCES "waste_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "data_completeness_requirements_organization_id_facility_id__key" RENAME TO "completeness_req_org_facility_category_key";

