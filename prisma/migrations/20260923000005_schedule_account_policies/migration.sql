-- Daily supplier account policies (password change reminders, inactivity
-- expiry). The job does nothing for organisations that have not switched the
-- policies on in settings. Uses scheduler.call_app from 20260922000010.
--
-- Skipped where pg_cron or that helper is unavailable (plain Postgres in CI).
DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  PERFORM cron.schedule('metricora-account-policies', '0 9 * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/account-policies')$cmd$);
END $do$;
