-- Add supplier role to org_role enum
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'supplier';

-- Supplier invite links (email-based, separate from field_worker InviteLink)
CREATE TABLE "supplier_invites" (
    "id"               TEXT NOT NULL,
    "organization_id"  TEXT NOT NULL,
    "email"            TEXT NOT NULL,
    "company_name"     TEXT,
    "token"            TEXT NOT NULL,
    "expires_at"       TIMESTAMPTZ NOT NULL,
    "used_at"          TIMESTAMPTZ,
    "used_by_user_id"  TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "supplier_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_invites_token_key" ON "supplier_invites"("token");
CREATE INDEX "supplier_invites_organization_id_idx" ON "supplier_invites"("organization_id");
CREATE INDEX "supplier_invites_email_idx" ON "supplier_invites"("email");

ALTER TABLE "supplier_invites"
    ADD CONSTRAINT "supplier_invites_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

ALTER TABLE "supplier_invites"
    ADD CONSTRAINT "supplier_invites_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");

-- Track which supplier submitted each EPD
ALTER TABLE "epd_records"
    ADD COLUMN IF NOT EXISTS "submitted_by_user_id" TEXT REFERENCES "users"("id");
CREATE INDEX IF NOT EXISTS "epd_records_submitted_by_user_id_idx"
    ON "epd_records"("submitted_by_user_id");
