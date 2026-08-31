# Production Migration Fix: P3009 Resolution

## Problem
The migration `20260831000020_catchup_supplier_reports` is marked as FAILED in the production database's `_prisma_migrations` table, blocking all subsequent deployments with error P3009.

## Root Cause
The `scripts/reset-migrations.ts` script marked this migration as applied without executing the SQL. When Prisma later tried to run the migration during deployment, it failed and became stuck.

## Solution

### Option 1: Automatic via Prisma (Recommended if you can run CLI in production environment)
```bash
# Set DATABASE_URL to production database URL
export DATABASE_URL="postgresql://user:password@host:port/carbonsite"

# Mark the migration as resolved
pnpm prisma migrate resolve --applied 20260831000020_catchup_supplier_reports
```

### Option 2: Manual SQL Fix (Direct database access)
Run this SQL command against the production PostgreSQL database:

```sql
-- Delete the failed migration record
DELETE FROM "_prisma_migrations" 
WHERE migration = '20260831000020_catchup_supplier_reports';

-- Verify it's deleted
SELECT * FROM "_prisma_migrations" 
WHERE migration LIKE '%catchup_supplier%';
```

Then the next Prisma migrate command will run the migration fresh.

### Option 3: Via Vercel Postgres Console (if using Vercel's Postgres)
1. Go to Vercel Dashboard → Storage → Postgres
2. Click "Browse Data" or "Query"
3. Run the SQL commands above
4. Deploy again

## Verification
After fixing, verify with:
```sql
-- Check the supplier_reports table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'supplier_reports'
);

-- Should return: true

-- Check the migration is now marked as applied
SELECT * FROM "_prisma_migrations" 
WHERE migration = '20260831000020_catchup_supplier_reports';

-- Should show: success status
```

## Next Steps After Fix
1. Run `pnpm prisma migrate deploy` to apply all pending migrations
2. Deploy to Vercel → should succeed now
3. Verify Supplier Reports tab loads data correctly
4. Confirm all OAuth flows work (QuickBooks, Sage, Xero already integrated)
