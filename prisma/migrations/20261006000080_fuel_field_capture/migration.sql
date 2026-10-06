-- Fuel entries from the field app. Additive only.
ALTER TYPE "field_document_type" ADD VALUE IF NOT EXISTS 'fuel_log';

ALTER TABLE "fuel_deliveries" ADD COLUMN     "field_submission_id" TEXT;
ALTER TABLE "fuel_issues" ADD COLUMN     "field_submission_id" TEXT;
ALTER TABLE "fuel_dips" ADD COLUMN     "field_submission_id" TEXT;
CREATE UNIQUE INDEX "fuel_deliveries_field_submission_id_key" ON "fuel_deliveries"("field_submission_id");
CREATE UNIQUE INDEX "fuel_issues_field_submission_id_key" ON "fuel_issues"("field_submission_id");
CREATE UNIQUE INDEX "fuel_dips_field_submission_id_key" ON "fuel_dips"("field_submission_id");
