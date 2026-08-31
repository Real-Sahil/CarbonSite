DO $$
BEGIN
  ALTER TABLE "invite_links" ADD COLUMN "email" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "invite_links_organization_id_email_idx" ON "invite_links"("organization_id", "email");
