-- Replace DocuSeal-specific columns with self-hosted signing fields
ALTER TABLE "document_signature_requests"
  DROP COLUMN IF EXISTS "docuseal_submission_id",
  DROP COLUMN IF EXISTS "docuseal_signing_url",
  ADD COLUMN "token"                  TEXT UNIQUE,
  ADD COLUMN "token_expires_at"       TIMESTAMP(3),
  ADD COLUMN "acknowledged_ip"        TEXT,
  ADD COLUMN "acknowledged_user_agent" TEXT,
  ADD COLUMN "signed_pdf_key"         TEXT;

DROP INDEX IF EXISTS "document_signature_requests_docuseal_submission_id_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "document_signature_requests_token_key" ON "document_signature_requests"("token");
CREATE INDEX IF NOT EXISTS "document_signature_requests_token_idx" ON "document_signature_requests"("token");
