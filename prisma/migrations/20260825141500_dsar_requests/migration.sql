-- Data Subject Access Requests (UK GDPR Art. 15 export / Art. 17 erasure).

DO $$ BEGIN
  CREATE TYPE "dsar_request_type" AS ENUM ('export', 'erasure');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "dsar_request_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "dsar_requests" (
    "id"                  TEXT NOT NULL,
    "user_id"             TEXT NOT NULL,
    "organization_id"     TEXT,
    "type"                "dsar_request_type" NOT NULL,
    "status"              "dsar_request_status" NOT NULL DEFAULT 'pending',
    "requested_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "due_by"              TIMESTAMPTZ NOT NULL,
    "completed_at"        TIMESTAMPTZ,
    "result_storage_key"  TEXT,
    "requested_by_user_id" TEXT NOT NULL,
    "notes"               TEXT,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"          TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dsar_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dsar_requests_status_due_by_idx" ON "dsar_requests"("status", "due_by");
CREATE INDEX IF NOT EXISTS "dsar_requests_user_id_idx" ON "dsar_requests"("user_id");

DO $$
BEGIN
  ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
