-- Vercel runs no persistent worker, so pg-boss schedules never fire and the
-- monitoring jobs (lone-worker welfare checks, permit expiry, submission SLA,
-- enforcement notices) and the calculation sweeps never ran. Schedule them
-- with Supabase pg_cron, calling the app's secret-protected routes via pg_net.
--
-- The app URL and shared secret live in Supabase Vault as `app_base_url` and
-- `scheduler_secret`; nothing sensitive is stored here. Rotate the secret by
-- updating both the Vault entry and the SCHEDULER_SECRET env var in Vercel.
--
-- Skipped where pg_cron is unavailable (plain Postgres in CI).
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net')
     OR to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

  CREATE SCHEMA IF NOT EXISTS scheduler;
  REVOKE ALL ON SCHEMA scheduler FROM PUBLIC;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION scheduler.call_app(path text)
    RETURNS bigint
    LANGUAGE sql
    SET search_path = ''
    AS $body$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || path,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'scheduler_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $body$
  $fn$;
  REVOKE ALL ON FUNCTION scheduler.call_app(text) FROM PUBLIC;

  -- Welfare checks alert when a worker misses pings for 30 minutes; checking
  -- every 5 minutes keeps the alert within 35 minutes of the last ping.
  PERFORM cron.schedule('metricora-worker-sessions', '*/5 * * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/worker-sessions')$cmd$);
  PERFORM cron.schedule('metricora-submission-sla', '0 6 * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/submission-sla')$cmd$);
  PERFORM cron.schedule('metricora-permit-expiry', '0 7 * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/permit-expiry')$cmd$);
  PERFORM cron.schedule('metricora-enforcement-notices', '0 8 * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/enforcement-notices')$cmd$);
  PERFORM cron.schedule('metricora-advance-calculation-runs', '*/2 * * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/advance-calculation-runs')$cmd$);
  PERFORM cron.schedule('metricora-calculation-schedules', '5 * * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/calculation-schedules')$cmd$);
END $do$;
