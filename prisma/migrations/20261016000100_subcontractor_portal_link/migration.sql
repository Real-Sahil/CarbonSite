-- Subcontractor portal links: token hash and expiry, submission channel, reminders.
-- Additive only; no deployed code depends on the new columns before this release.

-- CreateEnum
CREATE TYPE "subcontractor_submission_channel" AS ENUM ('portal_link', 'logged');

-- AlterTable
ALTER TABLE "subcontractor_carbon_submissions" ADD COLUMN     "last_reminder_at" TIMESTAMP(3),
ADD COLUMN     "link_sent_at" TIMESTAMP(3),
ADD COLUMN     "opened_at" TIMESTAMP(3),
ADD COLUMN     "reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "submitted_via" "subcontractor_submission_channel",
ADD COLUMN     "submitter_name" TEXT,
ADD COLUMN     "submitter_note" TEXT,
ADD COLUMN     "token_expires_at" TIMESTAMP(3),
ADD COLUMN     "token_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subcontractor_carbon_submissions_token_hash_key" ON "subcontractor_carbon_submissions"("token_hash");

