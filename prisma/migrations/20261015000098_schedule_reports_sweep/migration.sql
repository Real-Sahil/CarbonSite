-- Stalled-report sweep: pg_cron calls the app's secret-protected route every
-- 5 minutes (see 20260922000010_schedule_monitoring_jobs for the call_app helper).
--
-- Skipped where pg_cron, pg_net or the scheduler helper are missing (plain
-- Postgres in CI).
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

  PERFORM cron.schedule('metricora-reports', '*/5 * * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/reports')$cmd$);
END $do$;
