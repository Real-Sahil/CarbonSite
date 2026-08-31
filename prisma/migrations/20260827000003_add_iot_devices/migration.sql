-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "iot_device_type" AS ENUM ('electricity_meter', 'gas_meter', 'fuel_pump', 'water_meter');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "iot_devices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "device_type" "iot_device_type" NOT NULL,
    "serial_number" TEXT NOT NULL,
    "emission_category_code" TEXT NOT NULL,
    "facility_id" TEXT,
    "last_reading_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "iot_device_credentials" (
    "id" TEXT NOT NULL,
    "iot_device_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iot_device_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "meter_readings" (
    "id" TEXT NOT NULL,
    "iot_device_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "raw_value" NUMERIC(18,6) NOT NULL,
    "raw_unit" TEXT NOT NULL,
    "normalized_quantity" NUMERIC(18,6) NOT NULL,
    "normalized_unit" TEXT NOT NULL,
    "activity_record_id" TEXT,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "iot_devices_organization_id_serial_number_key" ON "iot_devices"("organization_id", "serial_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "iot_devices_organization_id_is_active_idx" ON "iot_devices"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "iot_devices_organization_id_facility_id_idx" ON "iot_devices"("organization_id", "facility_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "iot_device_credentials_key_hash_key" ON "iot_device_credentials"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "iot_device_credentials_prefix_key" ON "iot_device_credentials"("prefix");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "iot_device_credentials_iot_device_id_idx" ON "iot_device_credentials"("iot_device_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "iot_device_credentials_organization_id_idx" ON "iot_device_credentials"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "meter_readings_iot_device_id_timestamp_idx" ON "meter_readings"("iot_device_id", "timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "meter_readings_organization_id_created_at_idx" ON "meter_readings"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "meter_readings_activity_record_id_idx" ON "meter_readings"("activity_record_id");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "iot_device_credentials" ADD CONSTRAINT "iot_device_credentials_iot_device_id_fkey" FOREIGN KEY ("iot_device_id") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "iot_device_credentials" ADD CONSTRAINT "iot_device_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_iot_device_id_fkey" FOREIGN KEY ("iot_device_id") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_activity_record_id_fkey" FOREIGN KEY ("activity_record_id") REFERENCES "activity_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
