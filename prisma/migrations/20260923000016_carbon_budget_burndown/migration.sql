-- Carbon budget burn-down alerts: remember the last status alerted so the
-- daily monitor only notifies when a project's forecast gets worse.
ALTER TABLE "carbon_budgets" ADD COLUMN     "forecast_alert_level" TEXT,
ADD COLUMN     "forecast_alerted_at" TIMESTAMP(3);

-- Daily carbon budget forecast check. Skipped where pg_cron or the
-- scheduler.call_app helper (20260922000010) is unavailable (plain Postgres in CI).
DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  PERFORM cron.schedule('metricora-carbon-budgets', '30 6 * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/carbon-budgets')$cmd$);
END $do$;
