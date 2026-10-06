-- CreateTable
CREATE TABLE "fuel_stores" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_id" TEXT,
    "project_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fuel_type" TEXT NOT NULL,
    "capacity_litres" DECIMAL(12,2) NOT NULL,
    "ownership" "plant_ownership" NOT NULL DEFAULT 'owned',
    "identifier" TEXT,
    "bunded" BOOLEAN,
    "last_inspection_on" DATE,
    "on_site_from" DATE,
    "on_site_to" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_deliveries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "delivered_on" DATE NOT NULL,
    "fuel_type" TEXT NOT NULL,
    "litres" DECIMAL(12,2) NOT NULL,
    "supplier_name" TEXT,
    "reference" TEXT,
    "evidence_file_id" TEXT,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_issues" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "issued_on" DATE NOT NULL,
    "litres" DECIMAL(12,2) NOT NULL,
    "plant_asset_id" TEXT,
    "vehicle_label" TEXT,
    "meter_reading" DECIMAL(14,2),
    "issued_by_user_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_dips" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "dipped_on" DATE NOT NULL,
    "litres" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_dips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fuel_stores_organization_id_site_id_idx" ON "fuel_stores"("organization_id", "site_id");

-- CreateIndex
CREATE INDEX "fuel_stores_organization_id_project_id_idx" ON "fuel_stores"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "fuel_deliveries_organization_id_delivered_on_idx" ON "fuel_deliveries"("organization_id", "delivered_on");

-- CreateIndex
CREATE INDEX "fuel_deliveries_store_id_delivered_on_idx" ON "fuel_deliveries"("store_id", "delivered_on");

-- CreateIndex
CREATE INDEX "fuel_issues_organization_id_issued_on_idx" ON "fuel_issues"("organization_id", "issued_on");

-- CreateIndex
CREATE INDEX "fuel_issues_store_id_issued_on_idx" ON "fuel_issues"("store_id", "issued_on");

-- CreateIndex
CREATE INDEX "fuel_issues_organization_id_plant_asset_id_issued_on_idx" ON "fuel_issues"("organization_id", "plant_asset_id", "issued_on");

-- CreateIndex
CREATE INDEX "fuel_dips_store_id_dipped_on_idx" ON "fuel_dips"("store_id", "dipped_on");

-- AddForeignKey
ALTER TABLE "fuel_stores" ADD CONSTRAINT "fuel_stores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_deliveries" ADD CONSTRAINT "fuel_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_deliveries" ADD CONSTRAINT "fuel_deliveries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "fuel_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_issues" ADD CONSTRAINT "fuel_issues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_issues" ADD CONSTRAINT "fuel_issues_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "fuel_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_dips" ADD CONSTRAINT "fuel_dips_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_dips" ADD CONSTRAINT "fuel_dips_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "fuel_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Positive amounts only.
ALTER TABLE "fuel_stores" ADD CONSTRAINT "fuel_stores_capacity_positive" CHECK ("capacity_litres" > 0);
ALTER TABLE "fuel_deliveries" ADD CONSTRAINT "fuel_deliveries_litres_positive" CHECK ("litres" > 0);
ALTER TABLE "fuel_issues" ADD CONSTRAINT "fuel_issues_litres_positive" CHECK ("litres" > 0);
ALTER TABLE "fuel_dips" ADD CONSTRAINT "fuel_dips_litres_not_negative" CHECK ("litres" >= 0);

-- Row level security: the app connects as postgres, which bypasses it.
ALTER TABLE "fuel_stores" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_stores_deny_all" ON "fuel_stores" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "fuel_deliveries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_deliveries_deny_all" ON "fuel_deliveries" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "fuel_issues" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_issues_deny_all" ON "fuel_issues" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "fuel_dips" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_dips_deny_all" ON "fuel_dips" FOR ALL USING (false) WITH CHECK (false);
