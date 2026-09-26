-- Find a Tender: contracts imported from a notice, and each organisation's
-- tender watch and the notices that matched it (lib/tenders).

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "fts_notice_id" TEXT;

-- CreateTable
CREATE TABLE "tender_watches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cpv_prefixes" TEXT[],
    "regions" TEXT[],
    "keywords" TEXT[],
    "min_value" DECIMAL(18,2),
    "last_checked_at" TIMESTAMP(3),
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_watches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_opportunities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "ocid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "buyer_name" TEXT,
    "buyer_type" TEXT,
    "value_amount" DECIMAL(18,2),
    "currency" TEXT,
    "cpv_codes" TEXT[],
    "regions" TEXT[],
    "deadline" TIMESTAMP(3),
    "published_at" TIMESTAMP(3) NOT NULL,
    "matched_on" TEXT NOT NULL,
    "flags" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tender_watches_organization_id_key" ON "tender_watches"("organization_id");

-- CreateIndex
CREATE INDEX "tender_opportunities_organization_id_status_deadline_idx" ON "tender_opportunities"("organization_id", "status", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "tender_opportunities_organization_id_notice_id_key" ON "tender_opportunities"("organization_id", "notice_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_organization_id_fts_notice_id_key" ON "contracts"("organization_id", "fts_notice_id");

-- AddForeignKey
ALTER TABLE "tender_watches" ADD CONSTRAINT "tender_watches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_opportunities" ADD CONSTRAINT "tender_opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: the app connects as postgres; deny everything else.
ALTER TABLE "tender_watches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tender_watches_deny_all" ON "tender_watches" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "tender_opportunities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tender_opportunities_deny_all" ON "tender_opportunities" FOR ALL USING (false) WITH CHECK (false);

-- Daily Find a Tender check. Skipped where pg_cron or the scheduler is absent (CI).
DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  PERFORM cron.schedule('metricora-tenders', '40 5 * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/tenders')$cmd$);
END $do$;
