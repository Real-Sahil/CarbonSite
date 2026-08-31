-- Create AssuranceStatus enum
DO $$ BEGIN
  CREATE TYPE "AssuranceStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create snapshot_assurances table
CREATE TABLE IF NOT EXISTS "snapshot_assurances" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "snapshot_id" TEXT NOT NULL,
  "auditor_user_id" TEXT NOT NULL,
  "status" "AssuranceStatus" NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "signature_base64" TEXT,
  "signed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "snapshot_assurances_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on snapshot_id
CREATE UNIQUE INDEX IF NOT EXISTS "snapshot_assurances_snapshot_id_key" ON "snapshot_assurances"("snapshot_id");

-- Create indexes for queries
CREATE INDEX IF NOT EXISTS "snapshot_assurances_organization_id_status_idx" ON "snapshot_assurances"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "snapshot_assurances_auditor_user_id_status_idx" ON "snapshot_assurances"("auditor_user_id", "status");

-- Add foreign keys
DO $$
BEGIN
  ALTER TABLE "snapshot_assurances" ADD CONSTRAINT "snapshot_assurances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "snapshot_assurances" ADD CONSTRAINT "snapshot_assurances_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "published_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "snapshot_assurances" ADD CONSTRAINT "snapshot_assurances_auditor_user_id_fkey" FOREIGN KEY ("auditor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
