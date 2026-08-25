-- Add intensity metrics support for multi-year trend analysis
-- ReportingPeriod: Add reference values for carbon intensity calculations
-- DashboardAggregate: Add computed intensity ratios

ALTER TABLE reporting_periods
ADD COLUMN revenue_amount DECIMAL(18, 2),
ADD COLUMN revenue_currency VARCHAR(3),
ADD COLUMN fte_count DECIMAL(10, 2),
ADD COLUMN facility_area_m2 DECIMAL(15, 2);

ALTER TABLE dashboard_aggregates
ADD COLUMN intensity_per_revenue_unit DECIMAL(18, 8),
ADD COLUMN intensity_per_fte DECIMAL(18, 8),
ADD COLUMN intensity_per_m2 DECIMAL(18, 8);
