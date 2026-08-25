-- Add scope2_method to dashboard_aggregates to track location-based vs market-based electricity
-- Allows dashboards to show both Scope 2 calculation methods side-by-side

ALTER TABLE dashboard_aggregates
ADD COLUMN scope2_method VARCHAR(50);
