-- Add uncertainty quantification fields to EmissionCalculation
-- dataQualityScore (0-100): composite score based on evidence status, factor specificity, unit conversions
-- confidenceIntervalLower/Upper: CO2e bounds derived from quality score and calculation variance

ALTER TABLE emission_calculations
ADD COLUMN data_quality_score INT DEFAULT 50,
ADD COLUMN confidence_interval_lower DECIMAL(18, 8),
ADD COLUMN confidence_interval_upper DECIMAL(18, 8);

-- Quality score 50 = neutral baseline (assumed middle); will be computed per record during calculation runs
