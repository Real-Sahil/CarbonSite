-- Lone-worker check-ins were removed from the product: the app never started
-- a session and customers clock in with their site access systems. Stop the
-- five-minute monitor call; the route it called no longer exists. The
-- worker_sessions table stays (read by DSAR exports) until a later release.
--
-- Skipped where pg_cron is unavailable (plain Postgres in CI).
DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'metricora-worker-sessions') THEN
    PERFORM cron.unschedule('metricora-worker-sessions');
  END IF;
END $do$;
