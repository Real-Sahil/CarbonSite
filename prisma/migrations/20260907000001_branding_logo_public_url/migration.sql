-- Add logo_public_url to tenant_branding.
-- Presigned Supabase Storage URLs expire in 1 hour — too short to embed in
-- transactional emails whose recipients may open them days later. This column
-- stores a stable public URL that is safe to embed in email <img> tags.
-- Populated by the logo upload route using Supabase's public object URL
-- (requires the branding_public_read storage policy below).
ALTER TABLE "tenant_branding"
  ADD COLUMN IF NOT EXISTS "logo_public_url" TEXT;

-- Allow anonymous public read on branding assets only.
-- The carbonsite bucket is otherwise fully private. Only objects under the
-- org/*/branding/ path prefix are accessible without a signed URL, so this
-- policy is narrowly scoped and does not expose any tenant data.
CREATE POLICY IF NOT EXISTS "branding_public_read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'carbonsite'
  AND (storage.foldername(name))[1] = 'org'
  AND (storage.foldername(name))[3] = 'branding'
);
