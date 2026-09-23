-- Plant register and telematics readings. Monitoring only; not inventory. New tables.

-- CreateEnum
CREATE TYPE "plant_ownership" AS ENUM ('owned', 'hired');

-- CreateTable
CREATE TABLE "plant_assets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "asset_code" TEXT,
    "category" TEXT,
    "make" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "telematics_provider" TEXT,
    "fuel_type" TEXT NOT NULL DEFAULT 'diesel',
    "ownership" "plant_ownership" NOT NULL DEFAULT 'owned',
    "supplier_name" TEXT,
    "site_id" TEXT,
    "on_hire_from" DATE,
    "on_hire_to" DATE,
    "auto_registered" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plant_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_telematics_readings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "operating_hours" DECIMAL(12,3),
    "idle_hours" DECIMAL(12,3),
    "fuel_litres" DECIMAL(14,3),
    "idle_fuel_litres" DECIMAL(14,3),
    "cumulative_hours" DECIMAL(14,3),
    "cumulative_idle_hours" DECIMAL(14,3),
    "cumulative_fuel_litres" DECIMAL(16,3),
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_telematics_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plant_assets_organization_id_site_id_idx" ON "plant_assets"("organization_id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "plant_assets_organization_id_serial_number_key" ON "plant_assets"("organization_id", "serial_number");

-- CreateIndex
CREATE INDEX "plant_telematics_readings_organization_id_period_end_idx" ON "plant_telematics_readings"("organization_id", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "plant_telematics_readings_asset_id_period_end_key" ON "plant_telematics_readings"("asset_id", "period_end");

-- AddForeignKey
ALTER TABLE "plant_assets" ADD CONSTRAINT "plant_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_assets" ADD CONSTRAINT "plant_assets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_telematics_readings" ADD CONSTRAINT "plant_telematics_readings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_telematics_readings" ADD CONSTRAINT "plant_telematics_readings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "plant_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "plant_assets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plant_assets_deny_all" ON "plant_assets" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "plant_telematics_readings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plant_telematics_readings_deny_all" ON "plant_telematics_readings" FOR ALL USING (false) WITH CHECK (false);
