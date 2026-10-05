-- Monthly checklist reminder (lib/completeness/reminders.ts): on the 3rd of each
-- month editors are told what is outstanding for the month just ended. Skipped
-- where pg_cron or the scheduler is absent (CI).
DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  PERFORM cron.schedule('metricora-monthly-checklist', '15 7 3 * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/monthly-checklist')$cmd$);
END $do$;
