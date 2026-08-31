-- Gap items batch 2: plan field, webhook, import resumability, dashboard index, initiative methodology, evidence certified

-- Organization: add plan field
DO $$
BEGIN
  ALTER TABLE "organizations"
  ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'trial';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ImportBatch: add last_processed_row_index for resumable imports
DO $$
BEGIN
  ALTER TABLE "import_batches"
  ADD COLUMN "last_processed_row_index" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- DashboardAggregate: add compound index for scope-scoped snapshot queries
CREATE INDEX IF NOT EXISTS "dashboard_aggregates_org_snapshot_scope_idx"
  ON "dashboard_aggregates"("organization_id", "snapshot_id", "scope");

-- ReductionInitiative: add methodology field
DO $$
BEGIN
  ALTER TABLE "reduction_initiatives"
  ADD COLUMN "methodology" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- EvidenceClassification: add certified flag
DO $$
BEGIN
  ALTER TABLE "evidence_classifications"
  ADD COLUMN "certified" BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Webhook model
CREATE TABLE IF NOT EXISTS "webhooks" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "url"              TEXT NOT NULL,
  "secret"           TEXT NOT NULL,
  "events"           TEXT[],
  "enabled"          BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_user_id" TEXT NOT NULL,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhooks_organization_id_idx" ON "webhooks"("organization_id");

DO $$
BEGIN
  ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT "webhooks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- WebhookDelivery model
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id"           TEXT NOT NULL,
  "webhook_id"   TEXT NOT NULL,
  "event"        TEXT NOT NULL,
  "payload"      JSONB NOT NULL,
  "status_code"  INTEGER,
  "attempts"     INTEGER NOT NULL DEFAULT 0,
  "succeeded_at" TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_id_created_at_idx"
  ON "webhook_deliveries"("webhook_id", "created_at");

DO $$
BEGIN
  ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
