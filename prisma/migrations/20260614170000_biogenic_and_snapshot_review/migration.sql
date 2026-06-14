-- Biogenic CO2 tracking (GHG Protocol requires separate disclosure for biogenic carbon)
ALTER TABLE activity_records
  ADD COLUMN IF NOT EXISTS biogenic_co2e DECIMAL(18, 8);

ALTER TABLE emission_calculations
  ADD COLUMN IF NOT EXISTS biogenic_co2e DECIMAL(18, 8);

-- Snapshot peer-review gate
DO $$ BEGIN
  CREATE TYPE snapshot_verification_status AS ENUM ('pending_review', 'approved', 'changes_requested');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE published_snapshots
  ADD COLUMN IF NOT EXISTS verification_status snapshot_verification_status DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS verified_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Index to support querying unverified snapshots
CREATE INDEX IF NOT EXISTS published_snapshots_verification_idx
  ON published_snapshots (organization_id, verification_status);
