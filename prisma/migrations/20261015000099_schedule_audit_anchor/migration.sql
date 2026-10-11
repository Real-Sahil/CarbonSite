-- Daily audit-chain anchor: pg_cron calls the app's secret-protected monitor route, which copies
-- each organisation's chain head to object storage (lib/audit/anchor.ts). Same pattern as
-- 20261014000096_schedule_import_batches; see 20260922000010 for the call_app helper and Vault.
--
-- Skipped where pg_cron, pg_net or the scheduler helper are missing (plain Postgres in CI).
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

  PERFORM cron.schedule('metricora-audit-anchor', '23 4 * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/audit-anchor')$cmd$);
END $do$;
