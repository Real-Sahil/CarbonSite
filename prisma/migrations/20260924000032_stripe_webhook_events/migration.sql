-- Stripe webhook events already handled, so a redelivered event is skipped.
-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- Not tenant data and never read through the Data API: deny all.
ALTER TABLE "stripe_webhook_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stripe_webhook_events_deny_all" ON "stripe_webhook_events" FOR ALL USING (false) WITH CHECK (false);
