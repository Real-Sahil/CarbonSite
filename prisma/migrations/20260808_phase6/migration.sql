-- Phase 6: Carbon Budgeting, Waste Emissions, SBTi Net-Zero Roadmap

-- carbon_budgets
CREATE TABLE IF NOT EXISTS "carbon_budgets" (
  "id"                 TEXT         NOT NULL PRIMARY KEY,
  "organization_id"    TEXT         NOT NULL,
  "project_id"         TEXT         NOT NULL,
  "total_budget_tco2e" DECIMAL(18,4) NOT NULL,
  "floor_area_m2"      DECIMAL(12,2),
  "contract_value_gbp" DECIMAL(18,2),
  "notes"              TEXT,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "carbon_budgets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "carbon_budgets_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "carbon_budgets_project_id_key" ON "carbon_budgets"("project_id");
CREATE INDEX IF NOT EXISTS "carbon_budgets_organization_id_idx" ON "carbon_budgets"("organization_id");

-- carbon_budget_phases
CREATE TABLE IF NOT EXISTS "carbon_budget_phases" (
  "id"           TEXT         NOT NULL PRIMARY KEY,
  "budget_id"    TEXT         NOT NULL,
  "name"         TEXT         NOT NULL,
  "sort_order"   INTEGER      NOT NULL DEFAULT 0,
  "budget_tco2e" DECIMAL(18,4) NOT NULL,
  "actual_tco2e" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "notes"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "carbon_budget_phases_budget_id_fkey"
    FOREIGN KEY ("budget_id") REFERENCES "carbon_budgets"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "carbon_budget_phases_budget_id_sort_order_idx"
  ON "carbon_budget_phases"("budget_id", "sort_order");

-- waste_records
CREATE TABLE IF NOT EXISTS "waste_records" (
  "id"              TEXT         NOT NULL PRIMARY KEY,
  "organization_id" TEXT         NOT NULL,
  "project_id"      TEXT,
  "waste_type"      TEXT         NOT NULL,
  "disposal_route"  TEXT         NOT NULL,
  "weight_tonnes"   DECIMAL(12,4) NOT NULL,
  "co2e_tonnes"     DECIMAL(12,6),
  "ewc_code"        TEXT,
  "carrier_name"    TEXT,
  "recorded_at"     TIMESTAMP(3) NOT NULL,
  "notes"           TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "waste_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "waste_records_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "waste_records_organization_id_recorded_at_idx"
  ON "waste_records"("organization_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "waste_records_organization_id_project_id_idx"
  ON "waste_records"("organization_id", "project_id");

-- sbti_targets
CREATE TABLE IF NOT EXISTS "sbti_targets" (
  "id"                    TEXT         NOT NULL PRIMARY KEY,
  "organization_id"       TEXT         NOT NULL,
  "pathway"               TEXT         NOT NULL DEFAULT '1.5C',
  "base_year"             INTEGER      NOT NULL,
  "baseline_scope1_tco2e" DECIMAL(18,4) NOT NULL,
  "baseline_scope2_tco2e" DECIMAL(18,4) NOT NULL,
  "baseline_scope3_tco2e" DECIMAL(18,4),
  "near_term_year"        INTEGER      NOT NULL DEFAULT 2030,
  "near_term_reduction_pct" DECIMAL(5,2) NOT NULL,
  "net_zero_year"         INTEGER      NOT NULL DEFAULT 2050,
  "net_zero_reduction_pct" DECIMAL(5,2) NOT NULL DEFAULT 90,
  "status"                TEXT         NOT NULL DEFAULT 'draft',
  "notes"                 TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sbti_targets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "sbti_targets_organization_id_key"
  ON "sbti_targets"("organization_id");
