-- Every six hours pg_cron calls the monitor-health job (lib/monitoring/health.ts): it reports a scheduled
-- monitor that has not run within its expected interval, and a day on which more than 5% of dashboard loads
-- took 3 s or more. Same pattern as 20261016000101_schedule_subcontractor_reminders; see 20260922000010
-- for the call_app helper and Vault.
--
-- Skipped where pg_cron, pg_net or the scheduler helper are missing (plain Postgres in CI).
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

  PERFORM cron.schedule('metricora-monitor-health', '41 */6 * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/monitor-health')$cmd$);
END $do$;
