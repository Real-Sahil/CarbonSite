-- These policies granted access to any request carrying the Supabase
-- `authenticated` role. This app uses Better Auth, not Supabase Auth, but
-- Supabase Auth sign-up is reachable with the public anon key, so anyone
-- could register and then read, rewrite or clear rate-limit counters (undoing
-- brute-force protection) and read migration history. Replace them with
-- deny-all policies. The app connects as `postgres`, which bypasses RLS.
DROP POLICY IF EXISTS "rate_limit_buckets_select" ON "rate_limit_buckets";
DROP POLICY IF EXISTS "rate_limit_buckets_insert" ON "rate_limit_buckets";
DROP POLICY IF EXISTS "rate_limit_buckets_update" ON "rate_limit_buckets";
DROP POLICY IF EXISTS "rate_limit_buckets_delete" ON "rate_limit_buckets";
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limit_buckets_deny_all" ON "rate_limit_buckets" FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "storage_objects_select" ON "storage_objects";
DROP POLICY IF EXISTS "storage_objects_insert" ON "storage_objects";
DROP POLICY IF EXISTS "storage_objects_update" ON "storage_objects";
DROP POLICY IF EXISTS "storage_objects_delete" ON "storage_objects";
ALTER TABLE "storage_objects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "storage_objects_deny_all" ON "storage_objects" FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "prisma_migrations_select_auth" ON "_prisma_migrations";
