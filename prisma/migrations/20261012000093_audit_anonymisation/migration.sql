-- Audit anonymisation (lib/audit/anonymise.ts): rows older than six years lose their personal fields
-- and get redacted_at; the stored hash stays so the chain still links. Additive column only.
ALTER TABLE "audit_logs" ADD COLUMN "redacted_at" TIMESTAMP(3);

-- Monthly on the 4th at 03:10 UTC. Skipped where pg_cron or the scheduler is absent (CI).
DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL
     OR to_regprocedure('scheduler.call_app(text)') IS NULL THEN
    RETURN;
  END IF;

  PERFORM cron.schedule('metricora-audit-anonymise', '10 3 4 * *',
    $cmd$SELECT scheduler.call_app('/api/admin/schedule/monitors/audit-anonymise')$cmd$);
END $do$;
