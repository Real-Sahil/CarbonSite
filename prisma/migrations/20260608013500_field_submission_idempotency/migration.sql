-- Add idempotent retry support for field-worker mobile submissions.
DO $$
BEGIN
  ALTER TABLE "field_submissions" ADD COLUMN "idempotency_key" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "field_submission_idempotency_key"
ON "field_submissions"("organization_id", "submitted_by_user_id", "idempotency_key");
