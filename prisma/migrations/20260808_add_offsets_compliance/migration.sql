-- CreateTable: carbon_offsets
CREATE TABLE IF NOT EXISTS "carbon_offsets" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider"        TEXT NOT NULL,
    "project_name"    TEXT NOT NULL,
    "project_type"    TEXT NOT NULL,
    "standard"        TEXT NOT NULL DEFAULT 'VCS',
    "vintage"         INTEGER NOT NULL,
    "quantity_tonnes" DECIMAL(12,4) NOT NULL,
    "price_per_tonne" DECIMAL(10,2),
    "currency"        TEXT NOT NULL DEFAULT 'GBP',
    "purchased_at"    TIMESTAMP(3) NOT NULL,
    "serial_numbers"  TEXT,
    "retirement_ref"  TEXT,
    "notes"           TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carbon_offsets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: compliance_records
CREATE TABLE IF NOT EXISTS "compliance_records" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "framework"       TEXT NOT NULL,
    "reporting_year"  INTEGER NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'draft',
    "due_date"        TIMESTAMP(3),
    "submitted_at"    TIMESTAMP(3),
    "notes"           TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "carbon_offsets_organization_id_purchased_at_idx"
    ON "carbon_offsets"("organization_id", "purchased_at");

CREATE UNIQUE INDEX IF NOT EXISTS "compliance_records_organization_id_framework_reporting_year_key"
    ON "compliance_records"("organization_id", "framework", "reporting_year");

CREATE INDEX IF NOT EXISTS "compliance_records_organization_id_reporting_year_idx"
    ON "compliance_records"("organization_id", "reporting_year");

-- AddForeignKey
ALTER TABLE "carbon_offsets"
    ADD CONSTRAINT "carbon_offsets_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compliance_records"
    ADD CONSTRAINT "compliance_records_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
