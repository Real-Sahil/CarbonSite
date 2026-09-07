-- Add logo_public_url to tenant_branding.
-- Presigned R2 URLs expire in 1 hour — too short to embed in transactional
-- emails whose recipients may open them days later. This column stores a
-- stable public URL (R2 public bucket, CDN, or a long-lived signed URL)
-- that is safe to embed in email <img> tags. Populated by the logo upload
-- route when R2_PUBLIC_URL is set in the environment.
ALTER TABLE "tenant_branding"
  ADD COLUMN IF NOT EXISTS "logo_public_url" TEXT;
