-- Daily subcontractor reminders: pg_cron calls the app's secret-protected monitor route, which emails
-- each owed request's contact a fresh portal link (lib/subcontractor/reminders.ts). Same pattern as
-- 20261015000099_schedule_audit_anchor; see 20260922000010 for the call_app helper and Vault.
--
-- Skipped where pg_cron, pg_net or the scheduler helper are missing (plain Postgres in CI).
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

  PERFORM cron.schedule('metricora-subcontractor-reminders', '17 7 * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/subcontractor-reminders')$cmd$);
END $do$;
