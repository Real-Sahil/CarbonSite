-- Add scenario / what-if modeling tables for ephemeral calculation previews
-- ScenarioRun: tracks a what-if session tied to a committed CalculationRun
-- ScenarioDraft: hypothetical calculation result (never persisted to EmissionCalculation)

CREATE TABLE scenario_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calculation_run_id UUID NOT NULL REFERENCES calculation_runs(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX scenario_runs_org_expiry ON scenario_runs(organization_id, expires_at);

CREATE TABLE scenario_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scenario_run_id UUID NOT NULL REFERENCES scenario_runs(id) ON DELETE CASCADE,
  activity_record_id UUID NOT NULL REFERENCES activity_records(id),
  emission_factor_id UUID,
  original_amount DECIMAL(18, 6) NOT NULL,
  original_unit VARCHAR(255) NOT NULL,
  normalized_amount DECIMAL(18, 6) NOT NULL,
  normalized_unit VARCHAR(255) NOT NULL,
  co2 DECIMAL(18, 8),
  ch4 DECIMAL(18, 8),
  n2o DECIMAL(18, 8),
  total_co2e DECIMAL(18, 8) NOT NULL,
  selection_reason VARCHAR(255),
  factor_value DECIMAL(18, 8),
  formula TEXT NOT NULL,
  warnings JSONB DEFAULT '[]',
  data_quality_score INT DEFAULT 50,
  confidence_interval_lower DECIMAL(18, 8),
  confidence_interval_upper DECIMAL(18, 8),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX scenario_drafts_run_id ON scenario_drafts(scenario_run_id);
CREATE INDEX scenario_drafts_org_id ON scenario_drafts(organization_id);
