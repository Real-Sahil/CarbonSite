
-- CreateTable
CREATE TABLE "dashboard_slices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "snapshot_id" TEXT,
    "scope" INTEGER NOT NULL,
    "scope2_method" "scope2_method",
    "emission_category_id" TEXT NOT NULL,
    "facility_id" TEXT,
    "site_id" TEXT,
    "contract_id" TEXT,
    "supplier_key" TEXT,
    "month" DATE,
    "total_co2e" DECIMAL(18,8) NOT NULL,
    "record_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_slices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_slices_organization_id_reporting_period_id_snapsh_idx" ON "dashboard_slices"("organization_id", "reporting_period_id", "snapshot_id");

-- CreateIndex
CREATE INDEX "dashboard_slices_organization_id_snapshot_id_scope_idx" ON "dashboard_slices"("organization_id", "snapshot_id", "scope");

-- AddForeignKey
ALTER TABLE "dashboard_slices" ADD CONSTRAINT "dashboard_slices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_slices" ADD CONSTRAINT "dashboard_slices_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_slices" ADD CONSTRAINT "dashboard_slices_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "published_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: deny all (the app connects as postgres, which bypasses RLS)
ALTER TABLE "dashboard_slices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dashboard_slices_deny_all" ON "dashboard_slices" FOR ALL USING (false) WITH CHECK (false);
