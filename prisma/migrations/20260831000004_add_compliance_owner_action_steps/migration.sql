-- Migration: add owner, action_steps, external_link to compliance_records
-- These fields provide actionable guidance for admins tracking regulatory obligations

ALTER TABLE "compliance_records"
  ADD COLUMN IF NOT EXISTS "owner" TEXT,
  ADD COLUMN IF NOT EXISTS "action_steps" TEXT,
  ADD COLUMN IF NOT EXISTS "external_link" TEXT;
