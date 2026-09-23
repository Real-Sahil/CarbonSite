-- Remove objects left in production from before this schema, when the app
-- used Supabase Auth (auth.uid(), auth.users). None is in prisma/schema.prisma,
-- none is read or written by the app, and every table and column removed here
-- was checked empty in production on 2026-09-23 before this was written.
-- On any other database (a fresh clone, CI) they never existed, so every
-- statement is IF EXISTS / guarded and does nothing there.
--
-- contract-step: nothing deployed depends on these. The app reaches the
-- database only through Prisma (schema.prisma has no model, field or enum
-- for any of them) as the postgres role, which bypasses RLS; the anon and
-- authenticated roles have had no grants on public since 20260922000012.
-- The RLS policies dropped below admitted only Supabase Auth users.
-- Removed: tables audit_log, invite_link, organization_membership (0 rows;
-- the app uses audit_logs, invite_links, organization_memberships);
-- columns device_tokens.organization_id, verifications.organization_id,
-- platform_memberships.organization_id, platform_memberships.platform and
-- organizations.created_by_user_id (all NULL or default in every row); and
-- the unused enum type "ReviewStatus" (the app's is review_status).

-- 1. is_org_member(text) still read the legacy organization_membership table.
--    It backs the old Supabase-Auth RLS policies, which no caller can satisfy
--    (auth.uid() is never a Better Auth user id). Make it deny outright, like
--    is_org_member_for_rls (20260825153700), so dropping the table cannot
--    leave it broken.
DO $do$
BEGIN
  IF to_regprocedure('public.is_org_member(text)') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.is_org_member(org_id text)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SET search_path = public
    AS $fn$ SELECT false $fn$;
  END IF;
END $do$;

-- 2. Policies that reference the legacy table or columns (found through
--    pg_depend on production). All grant access only to a Supabase Auth user
--    (auth.uid()), which never exists here. The remaining
--    organizations_deny_public policy keeps organizations deny-all; the other
--    tables get a deny-all policy in step 6.
DROP POLICY IF EXISTS "organizations_member_access" ON "organizations";
DROP POLICY IF EXISTS "orgs_insert_creator" ON "organizations";
DROP POLICY IF EXISTS "verifications_org_access" ON "verifications";
DROP POLICY IF EXISTS "verifications_org_insert" ON "verifications";
DROP POLICY IF EXISTS "verifications_org_update" ON "verifications";
DROP POLICY IF EXISTS "social_value_records_org_member" ON "social_value_records";
DROP POLICY IF EXISTS "social_value_targets_org_member" ON "social_value_targets";

-- 3. Legacy tables (their own policies go with them). No CASCADE: if anything
--    unexpected still depends on them, this fails instead of removing it.
DROP TABLE IF EXISTS "audit_log";
DROP TABLE IF EXISTS "invite_link";
DROP TABLE IF EXISTS "organization_membership";

-- 4. Legacy columns (their indexes and foreign keys go with them).
ALTER TABLE "device_tokens" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "verifications" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "platform_memberships" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "platform_memberships" DROP COLUMN IF EXISTS "platform";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "created_by_user_id";

-- 5. Unused enum type.
DROP TYPE IF EXISTS "ReviewStatus";

-- 6. Keep every table whose old policies were removed deny-all, like every
--    other table.
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['verifications', 'social_value_records', 'social_value_targets'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (false) WITH CHECK (false)', t || '_deny_all', t);
    END IF;
  END LOOP;
END $do$;
