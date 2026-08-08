-- Embodied Carbon tables + multi-industry support
-- Phase 2 Workstreams 1 & 4

-- Global material library (seeded from ICE / CarboLifeCalc / RICS data)
CREATE TABLE IF NOT EXISTS "embodied_materials" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "category"       TEXT NOT NULL,
  "description"    TEXT,
  "gwp_a1_a3"      DOUBLE PRECISION NOT NULL,
  "gwp_a4"         DOUBLE PRECISION,
  "gwp_a5"         DOUBLE PRECISION,
  "gwp_c1_c4"      DOUBLE PRECISION,
  "gwp_d"          DOUBLE PRECISION,
  "declared_unit"  TEXT NOT NULL DEFAULT 'kg',
  "density"        DOUBLE PRECISION,
  "source"         TEXT NOT NULL DEFAULT 'ICE v3.0',
  "source_url"     TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "embodied_materials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "embodied_materials_name_key" ON "embodied_materials"("name");

-- Organisation-specific EPD uploads
CREATE TABLE IF NOT EXISTS "epd_records" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "material_id"     TEXT,
  "product_name"    TEXT NOT NULL,
  "manufacturer"    TEXT,
  "valid_from"      TIMESTAMPTZ,
  "valid_until"     TIMESTAMPTZ,
  "gwp_a1_a3"       DOUBLE PRECISION NOT NULL,
  "gwp_a4"          DOUBLE PRECISION,
  "gwp_a5"          DOUBLE PRECISION,
  "gwp_c1_c4"       DOUBLE PRECISION,
  "gwp_d"           DOUBLE PRECISION,
  "declared_unit"   TEXT NOT NULL DEFAULT 'kg',
  "storage_key"     TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "epd_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "epd_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "epd_records_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "embodied_materials"("id")
);

CREATE INDEX IF NOT EXISTS "epd_records_organization_id_idx" ON "epd_records"("organization_id");

-- Per-project embodied carbon records
CREATE TABLE IF NOT EXISTS "embodied_carbon_records" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "project_id"          TEXT,
  "reporting_period_id" TEXT,
  "material_id"         TEXT,
  "epd_id"              TEXT,
  "description"         TEXT,
  "quantity"            DOUBLE PRECISION NOT NULL,
  "unit"                TEXT NOT NULL DEFAULT 'kg',
  "gwp_a1_a3_used"      DOUBLE PRECISION NOT NULL,
  "gwp_a4_used"         DOUBLE PRECISION,
  "total_kg_co2e"       DOUBLE PRECISION NOT NULL,
  "lifecycle_stages"    TEXT[] NOT NULL DEFAULT '{}',
  "source"              TEXT NOT NULL DEFAULT 'manual',
  "field_submission_id" TEXT,
  "notes"               TEXT,
  "created_by_user_id"  TEXT NOT NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "embodied_carbon_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "embodied_carbon_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "embodied_carbon_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id"),
  CONSTRAINT "embodied_carbon_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id"),
  CONSTRAINT "embodied_carbon_records_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "embodied_materials"("id"),
  CONSTRAINT "embodied_carbon_records_epd_id_fkey" FOREIGN KEY ("epd_id") REFERENCES "epd_records"("id"),
  CONSTRAINT "embodied_carbon_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "embodied_carbon_records_org_project_idx" ON "embodied_carbon_records"("organization_id", "project_id");
CREATE INDEX IF NOT EXISTS "embodied_carbon_records_org_period_idx" ON "embodied_carbon_records"("organization_id", "reporting_period_id");

-- PPN 006 CRP report type
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'ppn_006_crp';
