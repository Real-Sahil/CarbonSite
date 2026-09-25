-- Base year and recalculation totals are documented, displayed and read as
-- tCO2e (base-year page, bid carbon pack, transition plan, PPN 006 plan), but
-- computePeriodTotals() summed DashboardAggregate kg into them, so every
-- stored figure was 1,000 times too large. The code now stores tonnes; this
-- converts the rows written before the fix. Every row in these two tables was
-- produced by that function (base-years POST, structural-change assessments
-- and approvals that copy restated into current), so all are divided.
-- Restatements are not touched: their totals may have been typed in tonnes.
UPDATE "base_years" SET
  "original_scope1_co2e" = "original_scope1_co2e" / 1000,
  "original_scope2_co2e" = "original_scope2_co2e" / 1000,
  "original_scope3_co2e" = "original_scope3_co2e" / 1000,
  "original_total_co2e"  = "original_total_co2e"  / 1000,
  "current_scope1_co2e"  = "current_scope1_co2e"  / 1000,
  "current_scope2_co2e"  = "current_scope2_co2e"  / 1000,
  "current_scope3_co2e"  = "current_scope3_co2e"  / 1000,
  "current_total_co2e"   = "current_total_co2e"   / 1000;

UPDATE "base_year_recalculations" SET
  "previous_scope1_co2e" = "previous_scope1_co2e" / 1000,
  "previous_scope2_co2e" = "previous_scope2_co2e" / 1000,
  "previous_scope3_co2e" = "previous_scope3_co2e" / 1000,
  "previous_total_co2e"  = "previous_total_co2e"  / 1000,
  "restated_scope1_co2e" = "restated_scope1_co2e" / 1000,
  "restated_scope2_co2e" = "restated_scope2_co2e" / 1000,
  "restated_scope3_co2e" = "restated_scope3_co2e" / 1000,
  "restated_total_co2e"  = "restated_total_co2e"  / 1000;
