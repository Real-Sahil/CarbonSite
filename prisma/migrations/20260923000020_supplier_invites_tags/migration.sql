-- supplier_invites.tags is in the Prisma schema and was added by
-- 20260828_add_xero_sync_and_supplier_tags, but production does not have it
-- (the table was recreated later without it). Prisma selects every column,
-- so any supplier invite query fails there. Additive and idempotent: a
-- database that already has the column is unchanged.
ALTER TABLE "supplier_invites" ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT '[]'::jsonb;
