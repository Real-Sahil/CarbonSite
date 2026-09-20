-- SLA notification tracking on field submissions
ALTER TABLE field_submissions
  ADD COLUMN IF NOT EXISTS sla_notified_at TIMESTAMPTZ;

-- Permit expiry alert tracking (prevent duplicate sends)
ALTER TABLE environmental_permits
  ADD COLUMN IF NOT EXISTS expiry_alert_sent_at TIMESTAMPTZ;

-- Permit condition due-date alert tracking
ALTER TABLE permit_conditions
  ADD COLUMN IF NOT EXISTS condition_alert_sent_at TIMESTAMPTZ;

-- TCFD scenario type enum
DO $$ BEGIN
  CREATE TYPE "TcfdScenarioType" AS ENUM ('physical', 'transition');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TCFD time horizon enum
DO $$ BEGIN
  CREATE TYPE "TcfdTimeHorizon" AS ENUM ('short', 'medium', 'long');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TCFD scenarios table
CREATE TABLE IF NOT EXISTS tcfd_scenarios (
  id                        TEXT        NOT NULL PRIMARY KEY,
  organization_id           TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scenario_type             "TcfdScenarioType" NOT NULL,
  name                      TEXT        NOT NULL,
  temperature_pathway       TEXT,
  time_horizon              "TcfdTimeHorizon" NOT NULL DEFAULT 'medium',
  description               TEXT,
  gross_value_at_risk_low   DECIMAL(18,2),
  gross_value_at_risk_high  DECIMAL(18,2),
  created_by_user_id        TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tcfd_scenarios_org ON tcfd_scenarios (organization_id);

-- TCFD risk assessments table
CREATE TABLE IF NOT EXISTS tcfd_risk_assessments (
  id                    TEXT        NOT NULL PRIMARY KEY,
  organization_id       TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scenario_id           TEXT        NOT NULL REFERENCES tcfd_scenarios(id) ON DELETE CASCADE,
  risk_category         TEXT        NOT NULL,
  description           TEXT        NOT NULL,
  likelihood            INTEGER     NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  impact                INTEGER     NOT NULL CHECK (impact BETWEEN 1 AND 5),
  financial_impact_low  DECIMAL(18,2),
  financial_impact_high DECIMAL(18,2),
  adaptation_actions    TEXT,
  residual_likelihood   INTEGER     CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact       INTEGER     CHECK (residual_impact BETWEEN 1 AND 5),
  review_date           DATE,
  owner_user_id         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tcfd_risks_scenario ON tcfd_risk_assessments (scenario_id);
CREATE INDEX IF NOT EXISTS idx_tcfd_risks_org      ON tcfd_risk_assessments (organization_id);
