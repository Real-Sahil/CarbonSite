-- Waste document expiry reminders (lib/waste/reminders.ts): Mondays at 07:40 UTC editors are told about
-- licences, permits and exemptions ending within 30 days or lapsed in the last 30. Skipped where pg_cron or
-- the scheduler is absent (CI).
DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  PERFORM cron.schedule('metricora-waste-documents', '40 7 * * 1',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/waste-documents')$cmd$);
END $do$;
