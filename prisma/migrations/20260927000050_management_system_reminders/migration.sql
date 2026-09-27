-- Daily management system reminders (review, due, expiry and certificate
-- dates; lib/management-systems/reminders.ts). Skipped where pg_cron or the
-- scheduler is absent (CI).
DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  PERFORM cron.schedule('metricora-management-systems', '10 6 * * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/management-systems')$cmd$);
END $do$;
