# Accounting Invoice Sync Setup

CarbonSite supports automated 2x daily invoice syncing from accounting platforms:
- **Xero** — Fully implemented, production-ready
- **QuickBooks** — Placeholder ready for SDK integration
- **Sage** — Placeholder ready for SDK integration

## Architecture

The sync pipeline:
1. Web process or external cron calls `/api/admin/schedule/accounting-sync`
2. Scheduler queries all orgs with accounting integrations enabled
3. For each org + provider combo, enqueues a sync job to pg-boss
4. Worker process (`pnpm worker`) picks up jobs and calls the sync function
5. Sync fetches invoices from accounting API, deduplicates, and inserts
6. Automatically enqueues anomaly detection for newly created invoices

## Manual Sync Trigger

To manually sync invoices for a specific org:

```bash
# Xero
curl -X POST http://localhost:3000/api/orgs/org123/integrations/xero/sync

# QuickBooks (queues job, but will fail until QB SDK implemented)
curl -X POST http://localhost:3000/api/orgs/org123/integrations/quickbooks/sync

# Sage (queues job, but will fail until Sage SDK implemented)
curl -X POST http://localhost:3000/api/orgs/org123/integrations/sage/sync

# With optional fromDate filter (Xero only, currently)
curl -X POST http://localhost:3000/api/orgs/org123/integrations/xero/sync?fromDate=2025-01-01
```

## Automated 2x Daily Scheduling

### Option 1: GitHub Actions (Recommended)

Create `.github/workflows/accounting-sync.yml`:

```yaml
name: Accounting Sync (2x Daily)
on:
  schedule:
    - cron: '0 6,18 * * *'  # 6am and 6pm UTC

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger accounting sync
        run: |
          curl -X POST https://your-app.vercel.app/api/admin/schedule/accounting-sync \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

**Setup:**
1. Add `CRON_SECRET` to your GitHub repo secrets
2. Set `CRON_SECRET` environment variable in Vercel/production

### Option 2: Vercel Crons

In `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/admin/schedule/accounting-sync",
    "schedule": "0 6,18 * * *"
  }]
}
```

Vercel automatically sends `Authorization` header. In production, the endpoint will validate.

### Option 3: External Cron Service

Services like EasyCron, cron-job.org, or AWS EventBridge can call:

```
POST https://your-app.vercel.app/api/admin/schedule/accounting-sync?secret=YOUR_CRON_SECRET
```

## Environment Variables

Required for scheduling:

```bash
# .env.local or Vercel environment
CRON_SECRET=your-random-secret-here
DATABASE_URL=postgresql://...
```

The endpoint validates `CRON_SECRET` from either:
- `x-cron-secret` header (recommended)
- `secret` query parameter (for simple cron services)

## Implementation Details

### Xero Sync (Fully Implemented)

**Job Type:** `XeroSyncJobData { orgId: string; fromDate?: string }`

**Queue Name:** `xero-sync`

**Worker:** `workers/index.ts` (lines 130-149)

**Sync Logic:** `lib/integrations/xero.ts`

**Deduplication:** Uses `XeroSyncLog` table with unique constraint on `(organizationId, invoiceId, lineItemIndex)`

**Anomaly Detection:** Automatically enqueues `InvoiceAnomalyDetection` job for newly created invoices

### QuickBooks & Sage (Placeholder)

**Job Types:** `QuickBooksSyncJobData`, `SageSyncJobData` (same shape as Xero)

**Queue Names:** `quickbooks-sync`, `sage-sync`

**Workers:** `workers/index.ts` (lines 150-194)

**Sync Logic:** Stub functions in `lib/integrations/quickbooks.ts` and `lib/integrations/sage.ts`

**TODO:** Implement actual OAuth token refresh + API calls for QB/Sage SDKs

## Testing

### Test Manually (Local Development)

1. Start worker: `pnpm worker`
2. Verify Xero is connected for an org
3. Call scheduler: `curl -X POST http://localhost:3000/api/admin/schedule/accounting-sync -H "x-cron-secret: test-secret"`
4. Monitor worker logs: `[scheduler] Queued Xero sync for org ...`
5. Check database: `SELECT * FROM xero_sync_logs ORDER BY created_at DESC LIMIT 10`

### Verify Scheduler (In Production)

1. Set `CRON_SECRET` in Vercel environment
2. Test endpoint: `curl -X POST https://your-app.vercel.app/api/admin/schedule/accounting-sync -H "x-cron-secret: $CRON_SECRET"`
3. Check logs (Vercel → Functions tab)
4. Verify jobs enqueued: `SELECT COUNT(*) FROM job WHERE name LIKE 'xero-sync' AND state != 'completed'`

## Troubleshooting

**Jobs queued but not processing:**
- Verify worker is running: `ps aux | grep 'pnpm worker'`
- Check `pg-boss` table: `SELECT * FROM pgboss.job LIMIT 10`
- Review worker logs for errors

**Anomaly detection not running:**
- Verify job was queued: `SELECT * FROM pgboss.job WHERE name = 'invoice-anomaly-jobs'`
- Check for errors in `processInvoiceAnomalies()` function

**Xero OAuth token expired:**
- Verify `xeroTokenExpiresAt` in `integration_configs` table
- Sync will refresh token automatically (5-minute threshold)
- If refresh fails, user must re-authorize in UI

## Next Steps

1. **QuickBooks:** Integrate QB SDK (requires `quickbooks-api` npm package)
   - Implement token refresh (similar to Xero)
   - Query `Query` resource for invoices
   - Map QB schema to internal format

2. **Sage:** Integrate Sage SDK (requires vendor SDK)
   - Implement token refresh
   - Query invoices endpoint
   - Map schema to internal format

3. **Scheduled Jobs:** Consider pg-boss scheduled jobs for fully internal scheduling (no cron service needed)
   - Can be configured in admin UI
   - Persists schedule across deployments
