-- Supplier priorities: one row per supplier per calculation run, with spend and headline
-- emissions, written by the run (lib/calculation/supplier-priorities-store.ts). Additive only:
-- a new table that no deployed code reads before this release.

-- CreateTable
CREATE TABLE "supplier_priorities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "calculation_run_id" TEXT NOT NULL,
    "supplier_key" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "spend_amount" DECIMAL(18,2) NOT NULL,
    "spend_currency" TEXT NOT NULL,
    "spend_record_count" INTEGER NOT NULL,
    "unconverted_spend_record_count" INTEGER NOT NULL,
    "total_co2e_kg" DECIMAL(18,8) NOT NULL,
    "record_count" INTEGER NOT NULL,
    "spend_rank" INTEGER,
    "emissions_rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_priorities_organization_id_reporting_period_id_idx" ON "supplier_priorities"("organization_id", "reporting_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_priorities_calculation_run_id_supplier_key_key" ON "supplier_priorities"("calculation_run_id", "supplier_key");

-- AddForeignKey
ALTER TABLE "supplier_priorities" ADD CONSTRAINT "supplier_priorities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_priorities" ADD CONSTRAINT "supplier_priorities_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_priorities" ADD CONSTRAINT "supplier_priorities_calculation_run_id_fkey" FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "supplier_priorities" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_priorities_deny_all" ON "supplier_priorities" FOR ALL USING (false) WITH CHECK (false);
