# URGENT: Fix Vercel Deployment (P3009 Error)

## What's Wrong
Vercel deployment is failing with P3009 error because migration `20260831000020_catchup_supplier_reports` is marked as FAILED in the production database.

## How to Fix (Choose ONE)

### ✅ EASIEST: Use Vercel Postgres Console (30 seconds)
1. Go to Vercel Dashboard → Storage tab → Select your Postgres database
2. Click "Data Studio" (or "Query" tab if available)
3. Run this exact SQL:
```sql
DELETE FROM "_prisma_migrations" 
WHERE migration = '20260831000020_catchup_supplier_reports';
```
4. Go back to Vercel deployments and click "Redeploy" on the failed build
5. ✅ Deployment should succeed now

### Alternative: Use Your Database Client (psql/DBeaver/TablePlus)
```bash
# If you have psql CLI access:
psql $DATABASE_URL -c "DELETE FROM \"_prisma_migrations\" WHERE migration = '20260831000020_catchup_supplier_reports';"
```

### Alternative: Use Prisma CLI (requires local setup)
```bash
# Set your production database URL
export DATABASE_URL="postgresql://..."

# Mark the migration as resolved
pnpm prisma migrate resolve --applied 20260831000020_catchup_supplier_reports
```

## What Happens Next
1. The failed migration record is deleted from the database
2. Next time Prisma runs, it will:
   - Skip the old failed migration `20260831000020_catchup_supplier_reports` (because it's not in `_prisma_migrations` anymore)
   - Run the new backup migration `20260831000021_ensure_supplier_reports_exists` (which is defensive and handles all edge cases)
   - Create the `supplier_reports` table successfully
3. All future deploys will work normally

## Verify It Worked
After fixing and redeploying:
1. Check Vercel build log → should complete successfully
2. Go to the web app → click Supplier Reports tab → should load without errors
3. Run quick verification:
```sql
SELECT COUNT(*) FROM "supplier_reports";  -- Should return: 0
```

## Why This Happened
The `scripts/reset-migrations.ts` file (now removed) was marking migrations as applied without running their SQL. This created a mismatch between the database state and the migrations table.

**All OAuth flows are already integrated and working:**
- ✅ Xero
- ✅ QuickBooks  
- ✅ Sage

No additional environment variables needed beyond what you've already added to Vercel.
