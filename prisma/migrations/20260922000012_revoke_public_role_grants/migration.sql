-- Supabase grants its public API roles (`anon`, `authenticated`) full access to
-- every table in `public`, and RLS is the only thing standing between those
-- grants and tenant data. This app never uses the Supabase Data API: it
-- connects as `postgres` through Prisma and authenticates with Better Auth.
-- Remove the grants so a missing or wrong RLS policy on a future table can no
-- longer expose it through the public anon key. Default privileges are revoked
-- too, so tables created by later migrations start without them.
--
-- The roles only exist on Supabase; plain Postgres (CI) skips this.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END
$do$;
