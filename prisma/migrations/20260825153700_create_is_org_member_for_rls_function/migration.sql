-- Creates is_org_member_for_rls(organization_id text), a dependency of the
-- policies added by 20260825153826_enable_rls_missing_tables and
-- 20260825154500_enable_rls_new_tables.
--
-- Those two migrations were written assuming this function already existed
-- in the database — it does, in production, but only because it was pasted
-- directly into the Supabase SQL editor from prisma/migrations/rls_policies.sql
-- (a loose file outside any migration directory, explicitly disclaimed there
-- as "not an enforced control" / never applied via `prisma migrate deploy`).
-- On any genuinely fresh database — a new dev clone, disaster recovery, or
-- this repo's own CI — `prisma migrate deploy` fails at
-- 20260825153826 with "function is_org_member_for_rls(text) does not exist"
-- and every later migration is blocked behind it.
--
-- Signature note: rls_policies.sql declares this function as
-- is_org_member_for_rls(org_id uuid). That signature was never actually
-- callable from the policies that need it — organization_id is text
-- (Prisma cuid()), not uuid, throughout this schema, and the failing error
-- confirms Postgres is resolving a text-argument call. This migration
-- creates the text-parameter version that's actually in use.
--
-- Behavior: always returns false, matching 20260825153826's own documented
-- rationale — this app authorizes via requireOrgMember()/
-- requirePlatformMember() in lib/auth/session.ts (Better Auth sessions),
-- never via Supabase Auth JWTs or PostgREST, so no caller reaching these
-- tables through Supabase's PostgREST/API surface can ever be a legitimate
-- organization member. Deny-all here is correct, not a placeholder. The
-- app's own Prisma connection uses the postgres role and bypasses RLS
-- entirely, so this has no effect on the app or workers.
CREATE OR REPLACE FUNCTION is_org_member_for_rls(organization_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false;
$$;
