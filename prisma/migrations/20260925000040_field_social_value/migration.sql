-- AlterEnum
ALTER TYPE "field_document_type" ADD VALUE 'social_value';

-- AlterTable
ALTER TABLE "sv_activities" ADD COLUMN     "field_submission_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sv_activities_field_submission_id_key" ON "sv_activities"("field_submission_id");

