-- Add review and approved to MethodStatementStatus enum
ALTER TYPE "MethodStatementStatus" ADD VALUE IF NOT EXISTS 'review';
ALTER TYPE "MethodStatementStatus" ADD VALUE IF NOT EXISTS 'approved';

-- Add new columns to method_statements
ALTER TABLE "method_statements"
  ADD COLUMN IF NOT EXISTS "sections_json" JSONB,
  ADD COLUMN IF NOT EXISTS "locked_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "revision_of" TEXT;
