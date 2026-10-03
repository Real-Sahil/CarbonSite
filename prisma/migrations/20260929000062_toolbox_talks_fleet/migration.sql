-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_toolbox_talk';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_toolbox_delivery';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_fleet_vehicle';

-- CreateTable
CREATE TABLE "ms_toolbox_talks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'general',
    "country" TEXT,
    "legal_basis" TEXT,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "file_id" TEXT,
    "owner_user_id" TEXT,
    "review_on" DATE,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_toolbox_talks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_toolbox_deliveries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "talk_id" TEXT NOT NULL,
    "delivered_on" DATE NOT NULL,
    "location" TEXT,
    "presenter_user_id" TEXT,
    "attendee_count" INTEGER,
    "attendees" TEXT,
    "duration_minutes" INTEGER,
    "notes" TEXT,
    "file_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_toolbox_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_fleet_vehicles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "description" TEXT,
    "powertrain" TEXT NOT NULL DEFAULT 'ice_diesel',
    "location" TEXT,
    "in_service_from" DATE,
    "in_service_to" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "owner_user_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_fleet_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ms_toolbox_talks_organization_id_status_idx" ON "ms_toolbox_talks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ms_toolbox_deliveries_organization_id_delivered_on_idx" ON "ms_toolbox_deliveries"("organization_id", "delivered_on");

-- CreateIndex
CREATE INDEX "ms_toolbox_deliveries_organization_id_talk_id_idx" ON "ms_toolbox_deliveries"("organization_id", "talk_id");

-- CreateIndex
CREATE INDEX "ms_fleet_vehicles_organization_id_status_idx" ON "ms_fleet_vehicles"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "ms_toolbox_talks" ADD CONSTRAINT "ms_toolbox_talks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_toolbox_deliveries" ADD CONSTRAINT "ms_toolbox_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_fleet_vehicles" ADD CONSTRAINT "ms_fleet_vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: deny all (the app connects as postgres, which bypasses RLS)
ALTER TABLE "ms_toolbox_talks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_toolbox_talks_deny_all" ON "ms_toolbox_talks" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_toolbox_deliveries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_toolbox_deliveries_deny_all" ON "ms_toolbox_deliveries" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_fleet_vehicles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_fleet_vehicles_deny_all" ON "ms_fleet_vehicles" FOR ALL USING (false) WITH CHECK (false);
