ALTER TABLE "invite_links" ADD COLUMN "email" TEXT;

CREATE INDEX "invite_links_organization_id_email_idx" ON "invite_links"("organization_id", "email");
