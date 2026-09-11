-- Phase I: Integration enrichment fields
-- EPC data on facilities, GLEIF LEI on legal entities, retirement verification on carbon offsets

-- ─── Facility: UK EPC (Energy Performance Certificate) ───────────────────────
-- Source: https://epc.opendatacommunities.org (free, API key signup, England+Wales)
-- Populated by the facility enrichment endpoint when UK postcode is set.
ALTER TABLE "facilities"
  ADD COLUMN IF NOT EXISTS "epc_rating"       TEXT,
  ADD COLUMN IF NOT EXISTS "epc_sap_score"    DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "epc_cert_number"  TEXT,
  ADD COLUMN IF NOT EXISTS "epc_assessed_at"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "epc_heating_type" TEXT;

-- ─── LegalEntity: GLEIF LEI (Legal Entity Identifier) ────────────────────────
-- Source: https://api.gleif.org/api/v1/ (free REST, no auth)
-- Auto-populated on entity creation when registration number is provided.
ALTER TABLE "legal_entities"
  ADD COLUMN IF NOT EXISTS "gleif_lei"           TEXT,
  ADD COLUMN IF NOT EXISTS "gleif_status"        TEXT,
  ADD COLUMN IF NOT EXISTS "gleif_looked_up_at"  TIMESTAMPTZ;

-- ─── CarbonOffset: OffsetsDB retirement verification ─────────────────────────
-- Source: https://offsets-db-data.readthedocs.io (free REST, no auth)
-- Aggregates Verra VCS, Gold Standard, ACR, CAR registries.
ALTER TABLE "carbon_offsets"
  ADD COLUMN IF NOT EXISTS "retirement_verified"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "retirement_verified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "offsets_db_project_id"  TEXT;
