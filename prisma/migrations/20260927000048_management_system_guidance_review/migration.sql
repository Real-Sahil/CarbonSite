-- The organisation controls the guidance: its own interpretation per
-- requirement, and a sign-off that a competent person reviewed MetricOra's
-- guidance for a framework. Additive only.

-- AlterTable
ALTER TABLE "ms_framework_adoptions" ADD COLUMN     "guidance_review_note" TEXT,
ADD COLUMN     "guidance_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "guidance_reviewed_by_user_id" TEXT,
ADD COLUMN     "guidance_reviewed_version" TEXT;

-- AlterTable
ALTER TABLE "ms_requirement_statuses" ADD COLUMN     "interpretation" TEXT;

