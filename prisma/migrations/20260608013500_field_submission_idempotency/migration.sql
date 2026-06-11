-- Add idempotent retry support for field-worker mobile submissions.
ALTER TABLE "field_submissions" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "field_submission_idempotency_key"
ON "field_submissions"("organization_id", "submitted_by_user_id", "idempotency_key");
