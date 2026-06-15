-- Gap items batch 2: plan field, webhook, import resumability, dashboard index, initiative methodology, evidence certified

-- Organization: add plan field
ALTER TABLE "organizations"
  ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'trial';

-- ImportBatch: add last_processed_row_index for resumable imports
ALTER TABLE "import_batches"
  ADD COLUMN "last_processed_row_index" INTEGER;

-- DashboardAggregate: add compound index for scope-scoped snapshot queries
CREATE INDEX "dashboard_aggregates_org_snapshot_scope_idx"
  ON "dashboard_aggregates"("organization_id", "snapshot_id", "scope");

-- ReductionInitiative: add methodology field
ALTER TABLE "reduction_initiatives"
  ADD COLUMN "methodology" TEXT;

-- EvidenceClassification: add certified flag
ALTER TABLE "evidence_classifications"
  ADD COLUMN "certified" BOOLEAN NOT NULL DEFAULT FALSE;

-- Webhook model
CREATE TABLE "webhooks" (
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

CREATE INDEX "webhooks_organization_id_idx" ON "webhooks"("organization_id");

ALTER TABLE "webhooks"
  ADD CONSTRAINT "webhooks_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "webhooks_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- WebhookDelivery model
CREATE TABLE "webhook_deliveries" (
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

CREATE INDEX "webhook_deliveries_webhook_id_created_at_idx"
  ON "webhook_deliveries"("webhook_id", "created_at");

ALTER TABLE "webhook_deliveries"
  ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey"
    FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
