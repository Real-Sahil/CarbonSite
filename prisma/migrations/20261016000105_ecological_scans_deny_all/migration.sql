-- ecological_scans has RLS on (20260915000002) but no policy, which Supabase
-- reports as rls_enabled_no_policy. Add the same deny-all policy as the other
-- tables. Only Prisma reads this table (postgres role, BYPASSRLS), and the
-- anon/authenticated roles have no grants on public, so the app is unaffected.
-- No TO clause: CI runs on plain Postgres 16, where Supabase roles do not exist.
ALTER TABLE "ecological_scans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ecological_scans_deny_all" ON "ecological_scans" FOR ALL USING (false) WITH CHECK (false);
