CREATE TABLE IF NOT EXISTS "supplier_data_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "supplier_email" TEXT NOT NULL,
    "supplier_name" TEXT,
    "category_code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_data_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_data_requests_token_key"
    ON "supplier_data_requests"("token");

CREATE INDEX IF NOT EXISTS "supplier_data_requests_organization_id_reporting_period_id_idx"
    ON "supplier_data_requests"("organization_id", "reporting_period_id");

CREATE INDEX IF NOT EXISTS "supplier_data_requests_organization_id_status_idx"
    ON "supplier_data_requests"("organization_id", "status");

DO $$
BEGIN
  ALTER TABLE "supplier_data_requests" ADD CONSTRAINT "supplier_data_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "supplier_data_requests" ADD CONSTRAINT "supplier_data_requests_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "supplier_data_requests" ADD CONSTRAINT "supplier_data_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
