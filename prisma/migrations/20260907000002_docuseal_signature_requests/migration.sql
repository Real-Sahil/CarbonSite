-- Phase: DocuSeal digital signature integration
-- Adds signature request tracking for report audit packages

CREATE TYPE "signature_request_status" AS ENUM (
  'pending',
  'sent',
  'signed',
  'declined',
  'expired'
);

CREATE TABLE "document_signature_requests" (
  "id"                     TEXT NOT NULL,
  "organization_id"        TEXT NOT NULL,
  "report_id"              TEXT NOT NULL,
  "status"                 "signature_request_status" NOT NULL DEFAULT 'pending',
  "signatory_email"        TEXT NOT NULL,
  "signatory_name"         TEXT NOT NULL,
  "docuseal_submission_id" INTEGER,
  "docuseal_signing_url"   TEXT,
  "signed_at"              TIMESTAMP(3),
  "declined_at"            TIMESTAMP(3),
  "requested_by_user_id"   TEXT NOT NULL,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "document_signature_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_signature_requests_organization_id_report_id_idx"
  ON "document_signature_requests" ("organization_id", "report_id");

CREATE UNIQUE INDEX "document_signature_requests_docuseal_submission_id_key"
  ON "document_signature_requests" ("docuseal_submission_id")
  WHERE "docuseal_submission_id" IS NOT NULL;

CREATE INDEX "document_signature_requests_docuseal_submission_id_idx"
  ON "document_signature_requests" ("docuseal_submission_id");

ALTER TABLE "document_signature_requests"
  ADD CONSTRAINT "document_signature_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_signature_requests"
  ADD CONSTRAINT "document_signature_requests_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "reports" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_signature_requests"
  ADD CONSTRAINT "document_signature_requests_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
