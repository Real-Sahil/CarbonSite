-- Marginal abatement cost curve fields on reduction initiatives, and the
-- data completeness matrix (facility x emission category requirements with
-- an owner, graded live against ActivityRecord coverage per period).

-- ─── MACC fields on reduction_initiatives ─────────────────────────────────────

ALTER TABLE "reduction_initiatives" ADD COLUMN IF NOT EXISTS "capex_amount" DECIMAL(18,2);
ALTER TABLE "reduction_initiatives" ADD COLUMN IF NOT EXISTS "opex_delta_annual" DECIMAL(18,2);
ALTER TABLE "reduction_initiatives" ADD COLUMN IF NOT EXISTS "lifetime_years" INTEGER;

-- ─── Data completeness requirements ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "data_completeness_requirements" (
  "id"                    TEXT NOT NULL,
  "organization_id"       TEXT NOT NULL,
  "facility_id"           TEXT NOT NULL,
  "emission_category_id"  TEXT NOT NULL,
  "owner_user_id"         TEXT,
  "required"              BOOLEAN NOT NULL DEFAULT true,
  "notes"                 TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "data_completeness_requirements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "data_completeness_requirements_org_facility_category_key"
  ON "data_completeness_requirements"("organization_id", "facility_id", "emission_category_id");

CREATE INDEX IF NOT EXISTS "data_completeness_requirements_organization_id_idx"
  ON "data_completeness_requirements"("organization_id");

DO $$ BEGIN
  ALTER TABLE "data_completeness_requirements" ADD CONSTRAINT "data_completeness_requirements_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "data_completeness_requirements" ADD CONSTRAINT "data_completeness_requirements_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "data_completeness_requirements" ADD CONSTRAINT "data_completeness_requirements_emission_category_id_fkey"
    FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "data_completeness_requirements" ADD CONSTRAINT "data_completeness_requirements_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
