-- Contaminated and hazardous material classification and movements. Additive only.
-- CreateTable
CREATE TABLE "material_classifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_id" TEXT,
    "project_id" TEXT,
    "name" TEXT NOT NULL,
    "material_kind" TEXT NOT NULL,
    "description" TEXT,
    "ewc_code" TEXT,
    "hazardous" BOOLEAN NOT NULL DEFAULT false,
    "hazardous_properties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lab_reference" TEXT,
    "classified_by" TEXT,
    "classified_on" DATE,
    "planned_route" TEXT,
    "estimated_tonnes" DECIMAL(12,3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "evidence_file_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_movements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "project_id" TEXT,
    "facility_id" TEXT,
    "classification_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "planned_on" DATE NOT NULL,
    "dispatched_at" TIMESTAMP(3),
    "received_on" DATE,
    "planned_tonnes" DECIMAL(12,3) NOT NULL,
    "ticket_tonnes" DECIMAL(12,3),
    "disposal_route" TEXT,
    "destination_name" TEXT NOT NULL,
    "destination_permit" TEXT,
    "destination_authorised_ewc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "carrier_name" TEXT,
    "carrier_registration" TEXT,
    "carrier_registration_expiry" DATE,
    "vehicle_registration" TEXT,
    "note_reference" TEXT,
    "haul_distance_km" DECIMAL(10,2),
    "returned_copy_due" DATE,
    "returned_copy_on" DATE,
    "evidence_file_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "waste_record_id" TEXT,
    "rejection_reason" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_classifications_organization_id_site_id_idx" ON "material_classifications"("organization_id", "site_id");

-- CreateIndex
CREATE INDEX "material_classifications_organization_id_status_idx" ON "material_classifications"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "material_movements_waste_record_id_key" ON "material_movements"("waste_record_id");

-- CreateIndex
CREATE INDEX "material_movements_organization_id_status_planned_on_idx" ON "material_movements"("organization_id", "status", "planned_on");

-- CreateIndex
CREATE INDEX "material_movements_organization_id_site_id_planned_on_idx" ON "material_movements"("organization_id", "site_id", "planned_on");

-- CreateIndex
CREATE INDEX "material_movements_classification_id_idx" ON "material_movements"("classification_id");

-- AddForeignKey
ALTER TABLE "material_classifications" ADD CONSTRAINT "material_classifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_movements" ADD CONSTRAINT "material_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_movements" ADD CONSTRAINT "material_movements_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "material_classifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "material_classifications" ADD CONSTRAINT "material_classifications_status_check" CHECK ("status" IN ('draft', 'approved', 'withdrawn'));
ALTER TABLE "material_movements" ADD CONSTRAINT "material_movements_status_check" CHECK ("status" IN ('planned', 'dispatched', 'received', 'rejected', 'cancelled'));
ALTER TABLE "material_movements" ADD CONSTRAINT "material_movements_tonnes_check" CHECK ("planned_tonnes" > 0 AND ("ticket_tonnes" IS NULL OR "ticket_tonnes" > 0));

ALTER TABLE "material_classifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_classifications_deny_all" ON "material_classifications" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "material_movements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_movements_deny_all" ON "material_movements" FOR ALL USING (false) WITH CHECK (false);
