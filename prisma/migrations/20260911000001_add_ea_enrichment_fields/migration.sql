-- Phase H addendum: EA spatial enrichment fields on Facility and EnvironmentalPermit
-- Adds nullable columns populated by the facility enrichment endpoint
-- (GET /api/orgs/:orgId/facilities/:facilityId/enrich) which calls the EA and
-- Natural England open data APIs. All columns are nullable and never block record
-- creation — enrichment is a background/on-demand operation, not required for
-- the facility to function in the inventory.

-- facilities: EA flood risk, SSSI proximity, WFD water body, AURN station
ALTER TABLE "facilities"
  ADD COLUMN "ea_flood_zone"             TEXT,
  ADD COLUMN "ea_flood_risk_assessed_at" TIMESTAMPTZ,
  ADD COLUMN "sssi_proximity_m"          INTEGER,
  ADD COLUMN "sssi_name"                 TEXT,
  ADD COLUMN "wfd_water_body_id"         TEXT,
  ADD COLUMN "wfd_ecological_status"     TEXT,
  ADD COLUMN "aurn_station_code"         TEXT,
  ADD COLUMN "ea_enrichment_last_run_at" TIMESTAMPTZ;

-- environmental_permits: EA public register cross-reference
ALTER TABLE "environmental_permits"
  ADD COLUMN "ea_register_ref"  TEXT,
  ADD COLUMN "ea_last_sync_at"  TIMESTAMPTZ;
