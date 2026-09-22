-- The carbonsite bucket was public, so every report, evidence file and import
-- in it could be downloaded by anyone holding its URL, with no expiry. All
-- downloads now go through server-side signed URLs, and email logos through
-- the app's /api/public/orgs/{orgId}/branding/logo proxy, so the bucket can be
-- private. Skipped on plain Postgres (CI), where the storage schema is absent.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RETURN;
  END IF;
  UPDATE storage.buckets SET public = false WHERE id = 'carbonsite';
  DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
END $$;

-- Direct bucket URLs stop working once the bucket is private. Email sending
-- rebuilds the proxy URL from the logo key when this column is empty.
UPDATE "tenant_branding"
SET "logo_public_url" = NULL
WHERE "logo_public_url" LIKE '%/storage/v1/object/%';
