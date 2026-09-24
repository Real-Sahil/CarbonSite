-- Private Supabase Storage bucket for the nightly database backups
-- (.github/workflows/backup.yml). Only the service role reaches it: no
-- storage.objects policy names this bucket, so the API roles see nothing.
-- Archives are encrypted before upload. Skipped on plain Postgres (CI), where
-- the storage schema is absent.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('backups', 'backups', false)
  ON CONFLICT (id) DO UPDATE SET public = false;
END $$;
