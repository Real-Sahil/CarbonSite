-- Creates emissions_forecasts, model_explanations, causal_analyses,
-- batch_jobs, and analytics_dashboard_cache — five tables schema.prisma has
-- declared models for (used live by lib/analytics/dashboard-cache-manager.ts)
-- but that no migration in this repo ever created. Discovered via
-- `prisma migrate diff` against a fresh database, the same class of gap as
-- the earlier airbite_connectors fix.

CREATE TABLE "emissions_forecasts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "facility_id" TEXT,
    "category_id" TEXT NOT NULL,
    "training_period_months" INTEGER NOT NULL,
    "training_data_points" INTEGER NOT NULL,
    "forecast_horizon_months" INTEGER NOT NULL DEFAULT 12,
    "forecast_start_date" TIMESTAMP(3) NOT NULL,
    "forecast_end_date" TIMESTAMP(3) NOT NULL,
    "forecast_data" JSONB NOT NULL,
    "forecast_method" TEXT NOT NULL DEFAULT 'exponential_smoothing',
    "mape" DECIMAL(5,2),
    "rmse" DECIMAL(15,2),
    "mae" DECIMAL(15,2),
    "r_squared" DECIMAL(3,2),
    "model_confidence" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "data_quality_score" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "anomaly_detection_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emissions_forecasts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "emissions_forecasts_organization_id_forecast_start_date_idx" ON "emissions_forecasts"("organization_id", "forecast_start_date" DESC);
CREATE INDEX "emissions_forecasts_organization_id_model_confidence_idx" ON "emissions_forecasts"("organization_id", "model_confidence" DESC);
CREATE UNIQUE INDEX "emissions_forecasts_organization_id_facility_id_category_id_key" ON "emissions_forecasts"("organization_id", "facility_id", "category_id", "forecast_start_date");

ALTER TABLE "emissions_forecasts" ADD CONSTRAINT "emissions_forecasts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emissions_forecasts" ADD CONSTRAINT "emissions_forecasts_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "emissions_forecasts" ADD CONSTRAINT "emissions_forecasts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "emission_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "model_explanations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "emission_calculation_id" TEXT NOT NULL,
    "feature_importance" JSONB NOT NULL,
    "top_driver_feature" TEXT NOT NULL,
    "top_driver_contribution_pct" DECIMAL(5,2) NOT NULL,
    "base_value" DECIMAL(15,2) NOT NULL,
    "prediction_value" DECIMAL(15,2) NOT NULL,
    "prediction_delta" DECIMAL(15,2) NOT NULL,
    "factor_contribution" DECIMAL(15,2) NOT NULL,
    "activity_contribution" DECIMAL(15,2) NOT NULL,
    "methodology_contribution" DECIMAL(15,2) NOT NULL,
    "explanationText" TEXT,
    "what_if_scenarios" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_explanations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "model_explanations_organization_id_created_at_idx" ON "model_explanations"("organization_id", "created_at" DESC);
CREATE UNIQUE INDEX "model_explanations_emission_calculation_id_key" ON "model_explanations"("emission_calculation_id");

ALTER TABLE "model_explanations" ADD CONSTRAINT "model_explanations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_explanations" ADD CONSTRAINT "model_explanations_emission_calculation_id_fkey" FOREIGN KEY ("emission_calculation_id") REFERENCES "emission_calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "causal_analyses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "facility_id" TEXT,
    "anomaly_type" TEXT NOT NULL,
    "anomaly_date" TIMESTAMP(3) NOT NULL,
    "observed_value" DECIMAL(15,2) NOT NULL,
    "expected_value" DECIMAL(15,2) NOT NULL,
    "deviation_pct" DECIMAL(5,2) NOT NULL,
    "likely_causes" JSONB NOT NULL,
    "primary_cause" TEXT,
    "primary_cause_confidence" DECIMAL(3,2),
    "causal_graph" JSONB,
    "treatment_variable" TEXT,
    "treatment_effect" DECIMAL(15,2),
    "treatment_effect_ci_lower" DECIMAL(15,2),
    "treatment_effect_ci_upper" DECIMAL(15,2),
    "affected_categories" TEXT[],
    "impact_on_total_emissions" DECIMAL(5,2) NOT NULL,
    "recommendations" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "investigated_by_user_id" TEXT,
    "investigated_at" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "causal_analyses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "causal_analyses_organization_id_anomaly_date_idx" ON "causal_analyses"("organization_id", "anomaly_date" DESC);
CREATE INDEX "causal_analyses_organization_id_status_idx" ON "causal_analyses"("organization_id", "status");
CREATE INDEX "causal_analyses_organization_id_primary_cause_confidence_idx" ON "causal_analyses"("organization_id", "primary_cause_confidence" DESC);

ALTER TABLE "causal_analyses" ADD CONSTRAINT "causal_analyses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "causal_analyses" ADD CONSTRAINT "causal_analyses_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "causal_analyses" ADD CONSTRAINT "causal_analyses_investigated_by_user_id_fkey" FOREIGN KEY ("investigated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "batch_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "total_items" INTEGER NOT NULL,
    "processed_items" INTEGER NOT NULL DEFAULT 0,
    "batch_size" INTEGER NOT NULL DEFAULT 100,
    "estimated_duration_seconds" INTEGER,
    "results" JSONB,
    "errorMessage" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "batch_jobs_organization_id_status_idx" ON "batch_jobs"("organization_id", "status");
CREATE INDEX "batch_jobs_organization_id_created_at_idx" ON "batch_jobs"("organization_id", "created_at" DESC);

ALTER TABLE "batch_jobs" ADD CONSTRAINT "batch_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analytics_dashboard_cache" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "forecast_total_co2e" DECIMAL(15,2),
    "forecast_trend" TEXT,
    "forecast_confidence" DECIMAL(3,2),
    "top_driver_feature" TEXT,
    "top_driver_pct" DECIMAL(5,2),
    "top_five_features" JSONB,
    "recent_anomalies_count" INTEGER NOT NULL DEFAULT 0,
    "unresolved_anomalies_count" INTEGER NOT NULL DEFAULT 0,
    "recent_root_causes" JSONB,
    "scenario_results" JSONB,
    "last_forecast_run" TIMESTAMP(3),
    "last_explanation_run" TIMESTAMP(3),
    "last_causal_analysis" TIMESTAMP(3),
    "cached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL DEFAULT NOW() + INTERVAL '24 hours',

    CONSTRAINT "analytics_dashboard_cache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_dashboard_cache_organization_id_cached_at_idx" ON "analytics_dashboard_cache"("organization_id", "cached_at" DESC);
CREATE INDEX "analytics_dashboard_cache_organization_id_expires_at_idx" ON "analytics_dashboard_cache"("organization_id", "expires_at");
CREATE UNIQUE INDEX "analytics_dashboard_cache_organization_id_reporting_period__key" ON "analytics_dashboard_cache"("organization_id", "reporting_period_id");

ALTER TABLE "analytics_dashboard_cache" ADD CONSTRAINT "analytics_dashboard_cache_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_dashboard_cache" ADD CONSTRAINT "analytics_dashboard_cache_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
