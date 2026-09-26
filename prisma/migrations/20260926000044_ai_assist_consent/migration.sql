-- Per-organisation consent to AI-assisted wording in reports and suggestions.
-- Off by default: nothing is sent to an AI provider until an admin turns it on.

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "ai_assist_enabled" BOOLEAN NOT NULL DEFAULT false;

