-- Add reusable flag to invite_links.
-- When true: link never gets marked used and can be accepted multiple times.
-- Used for App Store / Play Store reviewer access.
ALTER TABLE "invite_links" ADD COLUMN "reusable" BOOLEAN NOT NULL DEFAULT false;
