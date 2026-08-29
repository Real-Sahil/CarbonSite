-- Create forecasts table for time-series predictions
CREATE TABLE IF NOT EXISTS "forecasts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "forecast_type" TEXT NOT NULL, -- 'emissions', 'supplier_quality', 'anomaly_rate'
    "target_period_start" TIMESTAMP(3) NOT NULL,
    "target_period_end" TIMESTAMP(3) NOT NULL,
    "predictions" JSONB NOT NULL, -- array of {date, forecast, lowerBound, upperBound, confidence}
    "accuracy" DECIMAL(5,2),
    "model_version" TEXT NOT NULL, -- 'exponential_smoothing_v1', 'seasonal_decomposition_v1'
    "training_data_points" INTEGER NOT NULL,
    "method" TEXT NOT NULL, -- 'exponential_smoothing', 'seasonal_decomposition'
    "metadata" JSONB, -- method-specific parameters
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "forecasts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "forecasts_organization_id_forecast_type_target_period_start_key" UNIQUE ("organization_id", "forecast_type", "target_period_start")
);

-- Create indexes for forecasts
CREATE INDEX IF NOT EXISTS "forecasts_organization_id_forecast_type_generated_at_idx" ON "forecasts"("organization_id", "forecast_type", "generated_at" DESC);
CREATE INDEX IF NOT EXISTS "forecasts_organization_id_valid_until_idx" ON "forecasts"("organization_id", "valid_until");
CREATE INDEX IF NOT EXISTS "forecasts_organization_id_idx" ON "forecasts"("organization_id");
