-- Additive: marks that the overdue alert for a notice has been sent.
ALTER TABLE "enforcement_notices" ADD COLUMN IF NOT EXISTS "overdue_alerted_at" TIMESTAMPTZ(6);
