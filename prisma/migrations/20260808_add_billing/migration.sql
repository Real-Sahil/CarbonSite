-- CreateTable: billing_subscriptions
CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
    "id"                    TEXT NOT NULL,
    "organization_id"       TEXT NOT NULL,
    "plan"                  TEXT NOT NULL DEFAULT 'trial',
    "status"                TEXT NOT NULL DEFAULT 'active',
    "trial_ends_at"         TIMESTAMP(3),
    "current_period_start"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end"    TIMESTAMP(3) NOT NULL,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: usage_events
CREATE TABLE IF NOT EXISTS "usage_events" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_type"      TEXT NOT NULL,
    "quantity"        INTEGER NOT NULL DEFAULT 1,
    "metadata"        JSONB,
    "recorded_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscriptions_organization_id_key"
    ON "billing_subscriptions"("organization_id");

CREATE INDEX IF NOT EXISTS "usage_events_organization_id_event_type_recorded_at_idx"
    ON "usage_events"("organization_id", "event_type", "recorded_at");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
