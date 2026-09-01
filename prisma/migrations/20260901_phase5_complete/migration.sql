-- Phase 5: Complete ML/Analytics Suite
-- 5A: Time-Series Forecasting (Prophet)
-- 5B: Model Explainability (SHAP-like feature importance)
-- 5C: Root Cause Analysis (Causal inference)
-- 5D: Distributed Computing (batching strategy)
-- 5E: Advanced Analytics Dashboard

-- ─── 5A: Emissions Forecasting ───────────────────────────────────────────────

CREATE TABLE emissions_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES "facilities"(id) ON DELETE SET NULL,
  category_id UUID NOT NULL REFERENCES "emission_categories"(id),

  -- Historical data used for forecast
  training_period_months INT NOT NULL, -- e.g., 12 for last 12 months
  training_data_points INT NOT NULL,

  -- Forecast parameters
  forecast_horizon_months INT NOT NULL DEFAULT 12, -- predict 12 months ahead
  forecast_start_date DATE NOT NULL,
  forecast_end_date DATE NOT NULL,

  -- Forecast results (time-series points)
  forecast_data JSONB NOT NULL, -- [{date, predicted_value, lower_ci, upper_ci, confidence}, ...]
  forecast_method TEXT NOT NULL DEFAULT 'exponential_smoothing', -- 'exponential_smoothing' | 'arima' | 'linear_regression'

  -- Accuracy metrics
  mape DECIMAL(5, 2), -- Mean Absolute Percentage Error (0-100%)
  rmse DECIMAL(15, 2), -- Root Mean Squared Error
  mae DECIMAL(15, 2), -- Mean Absolute Error
  r_squared DECIMAL(3, 2), -- R² (0-1)

  -- Confidence and quality
  model_confidence DECIMAL(3, 2) NOT NULL DEFAULT 0.5, -- 0-1
  data_quality_score DECIMAL(3, 2) NOT NULL DEFAULT 0.5, -- 0-1
  anomaly_detection_applied BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, facility_id, category_id, forecast_start_date)
);

-- ─── 5B: Model Explainability & Feature Importance ──────────────────────────

CREATE TABLE model_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  emission_calculation_id UUID NOT NULL REFERENCES "emission_calculations"(id) ON DELETE CASCADE,

  -- Feature importance scores (SHAP-like)
  feature_importance JSONB NOT NULL, -- [{feature_name, importance_value, impact_direction, confidence}, ...]

  -- Top drivers (for dashboard)
  top_driver_feature TEXT NOT NULL, -- e.g., "activity_volume"
  top_driver_contribution_pct DECIMAL(5, 2) NOT NULL, -- what % of the prediction is due to top driver

  -- Prediction explanation
  base_value DECIMAL(15, 2) NOT NULL, -- baseline/intercept
  prediction_value DECIMAL(15, 2) NOT NULL, -- final prediction
  prediction_delta DECIMAL(15, 2) NOT NULL, -- prediction_value - base_value

  -- Individual factor contributions
  factor_contribution DECIMAL(15, 2) NOT NULL, -- contribution from selected factor
  activity_contribution DECIMAL(15, 2) NOT NULL, -- contribution from activity volume
  methodology_contribution DECIMAL(15, 2) NOT NULL, -- contribution from methodology/year

  -- Interactive explanations (for UI)
  explanation_text TEXT, -- human-readable explanation
  what_if_scenarios JSONB, -- [{scenario_name, predicted_value, change_pct}, ...]

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(emission_calculation_id)
);

-- ─── 5C: Root Cause Analysis & Causal Inference ──────────────────────────────

CREATE TABLE causal_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES "facilities"(id) ON DELETE SET NULL,

  -- Anomaly/change being analyzed
  anomaly_type TEXT NOT NULL, -- 'spike' | 'drop' | 'trend_change' | 'unexpected_value'
  anomaly_date DATE NOT NULL,
  observed_value DECIMAL(15, 2) NOT NULL,
  expected_value DECIMAL(15, 2) NOT NULL,
  deviation_pct DECIMAL(5, 2) NOT NULL, -- (observed - expected) / expected * 100

  -- Root cause analysis
  likely_causes JSONB NOT NULL, -- [{cause, probability, evidence, recommendation}, ...]
  primary_cause TEXT, -- e.g., "increased_production_volume"
  primary_cause_confidence DECIMAL(3, 2), -- 0-1

  -- Causal inference results
  causal_graph JSONB, -- DAG of variables and their causal relationships
  treatment_variable TEXT, -- e.g., "production_volume"
  treatment_effect DECIMAL(15, 2), -- estimated causal impact
  treatment_effect_ci_lower DECIMAL(15, 2), -- confidence interval
  treatment_effect_ci_upper DECIMAL(15, 2),

  -- Impact on organization
  affected_categories TEXT ARRAY, -- ['s1-stationary', 's2-electricity-mb', ...]
  impact_on_total_emissions DECIMAL(5, 2), -- pct change to org total

  -- Recommendations
  recommendations JSONB NOT NULL, -- [{action, expected_impact_pct, effort_level}, ...]

  -- Status
  status TEXT DEFAULT 'pending_review' NOT NULL, -- 'pending_review' | 'investigated' | 'resolved' | 'dismissed'
  investigated_by_user_id UUID REFERENCES "users"(id),
  investigated_at TIMESTAMP,
  resolution_notes TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── 5D: Distributed Processing & Batching ──────────────────────────────────

CREATE TABLE batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,

  -- Job metadata
  job_type TEXT NOT NULL, -- 'forecast_generation' | 'explanation_generation' | 'causal_analysis'
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'processing' | 'completed' | 'failed'

  -- Batching info (for distributed processing)
  total_items INT NOT NULL,
  processed_items INT DEFAULT 0,
  batch_size INT DEFAULT 100, -- items processed per batch
  estimated_duration_seconds INT,

  -- Progress tracking
  progress_pct INT GENERATED ALWAYS AS (
    CASE WHEN total_items = 0 THEN 0 ELSE (processed_items * 100) / total_items END
  ) STORED,

  -- Results
  results JSONB, -- summary of batch results
  error_message TEXT,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── 5E: Dashboard Aggregates (for fast queries) ────────────────────────────

CREATE TABLE analytics_dashboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  reporting_period_id UUID NOT NULL REFERENCES "reporting_periods"(id) ON DELETE CASCADE,

  -- Forecast summary
  forecast_total_co2e DECIMAL(15, 2), -- forecasted total for next 12 months
  forecast_trend TEXT, -- 'increasing' | 'decreasing' | 'stable'
  forecast_confidence DECIMAL(3, 2),

  -- Top drivers (from explainability)
  top_driver_feature TEXT,
  top_driver_pct DECIMAL(5, 2),
  top_5_features JSONB, -- [{name, importance_pct}, ...]

  -- Anomalies & root causes
  recent_anomalies_count INT DEFAULT 0,
  unresolved_anomalies_count INT DEFAULT 0,
  recent_root_causes JSONB, -- [{anomaly, primary_cause, confidence}, ...]

  -- What-if scenarios (for forecasting)
  scenario_results JSONB, -- [{scenario_name, forecasted_value, change_pct}, ...]

  -- Metadata
  last_forecast_run TIMESTAMP,
  last_explanation_run TIMESTAMP,
  last_causal_analysis TIMESTAMP,

  cached_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  UNIQUE(organization_id, reporting_period_id)
);

-- Create indices for common queries
CREATE INDEX IF NOT EXISTS emissions_forecasts_by_facility
  ON emissions_forecasts(organization_id, facility_id, forecast_end_date DESC);

CREATE INDEX IF NOT EXISTS model_explanations_by_calculation
  ON model_explanations(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS causal_analyses_by_facility
  ON causal_analyses(organization_id, facility_id, status);

CREATE INDEX IF NOT EXISTS batch_jobs_by_type
  ON batch_jobs(organization_id, job_type, status);
