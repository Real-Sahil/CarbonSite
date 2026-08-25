# Deployment Checklist

Pre-deployment verifications for CarbonSite production deployments.

## Database Security

### Row-Level Security (RLS) Bypass Verification

**Status:** RLS is configured but not enforced on the application layer (see SECURITY.md for details).

The Prisma connection to PostgreSQL authenticates as the `postgres` role, which must have `rolbypassrls = true` to bypass RLS policies. This allows the application to function normally. The RLS policies exist as a secondary defense layer for the Supabase PostgREST API surface only.

**Pre-deployment check:**
```bash
pnpm check:rls-bypass
```

This verifies that the production database role has RLS bypass enabled. The check queries `pg_roles.rolbypassrls` for the `postgres` role and fails if it's not `true`.

**Why this matters:**
- If RLS bypass is disabled, the application will fail (Prisma queries will be blocked by RLS)
- This should only change by explicit action, never silently
- The check ensures accidental configuration changes are caught

**Manual verification (if check fails):**
```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'postgres';
-- Expected: postgres | t
```

## Deployment Steps

1. ✓ Verify dependencies are up-to-date (pnpm audit --prod)
2. ✓ Run typecheck and tests locally
3. ✓ Create and test migrations on a staging database
4. ✓ Verify RLS bypass status (`pnpm check:rls-bypass`)
5. Deploy migrations (`pnpm prisma migrate deploy` on production)
6. Deploy application code to Vercel/production environment
7. Monitor error tracking (Sentry) for the first 30 minutes
