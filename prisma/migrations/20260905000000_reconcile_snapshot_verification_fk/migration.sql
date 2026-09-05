-- Reconciles two schema.prisma <-> applied-migrations drift items found via
-- `prisma migrate diff` after applying the full migration history to a fresh
-- database. Of the ~140 differences the diff reported, only these two change
-- anything observable: everything else was either cosmetic index renames,
-- ON UPDATE NO ACTION -> CASCADE on primary-key columns that are never
-- updated in place (cuid PKs), or ON DELETE behavior changes left
-- deliberately out of this migration pending a look at real production data
-- (see chat history / PR description for the full breakdown).

-- ============================================================================
-- Missing foreign key: PublishedSnapshot.verifiedByUserId has declared a real
-- relation to User in schema.prisma (onDelete: SetNull) since the assurance
-- workspace was built, but no migration ever added the actual constraint to
-- the database. Right now nothing stops verified_by_user_id from pointing at
-- a deleted user on the one model that is the audit anchor for published
-- emissions data. Wrapped defensively in case it was already added by some
-- other path.
-- ============================================================================
DO $$
BEGIN
  ALTER TABLE "published_snapshots"
    ADD CONSTRAINT "published_snapshots_verified_by_user_id_fkey"
    FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Orphaned foreign key: ScenarioDraft.organizationId has no @relation in
-- schema.prisma (it is a plain scoping column, not a Prisma relation), but
-- the database still carries the foreign key constraint from when it was
-- one. Dropping it here just catches the database up to what the schema
-- already declares - no application code relies on this constraint since
-- Prisma never generated a relation for it.
-- ============================================================================
ALTER TABLE "scenario_drafts" DROP CONSTRAINT IF EXISTS "scenario_drafts_organization_id_fkey";
