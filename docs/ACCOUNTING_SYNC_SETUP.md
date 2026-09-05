# Accounting Invoice Sync Setup

CarbonSite supports automated 2x daily invoice syncing from accounting platforms:
- **Xero** — Fully implemented, production-ready
- **QuickBooks** — OAuth connect works; invoice fetching is not implemented (no SDK integration)
- **Sage** — OAuth connect works; invoice fetching is not implemented (no SDK integration)

## Architecture

This deployment is Vercel-only (see CLAUDE.md — "Background Jobs"): there is
no separate process running `workers/index.ts` continuously, so sync does
**not** depend on a pg-boss worker being up. All sync-triggering paths go
through `lib/jobs/dispatch.ts`, which defaults to `JOB_PROCESSING_MODE=inline`:

1. Web process or external cron calls `/api/admin/schedule/accounting-sync`
2. `scheduleAccountingSyncForAllOrgs()` queries all orgs with accounting integrations enabled
3. For each connected org, calls `dispatchXeroSync()` — in the default inline
   mode this runs `syncXeroInvoices()` synchronously in the same request,
   not via a queue
4. Sync fetches invoices from the Xero API, deduplicates against `XeroSyncLog`,
   and inserts `InvoiceRecord` rows
5. If any new invoices were created, and the org's plan includes
   `invoiceAnomalyDetection` (Enterprise), `dispatchInvoiceAnomalyDetection()`
   runs `detectInvoiceAnomalies()` inline too

Setting `JOB_PROCESSING_MODE=worker` switches every step above to enqueue to
pg-boss instead, for a deployment that *does* run `pnpm worker` continuously
— `workers/index.ts` still has consumers for `xero-sync`, `quickbooks-sync`,
`sage-sync`, and `invoice-anomaly-jobs` for that case.

## Manual Sync Trigger

To manually sync invoices for a specific org (requires an authenticated
admin/editor session — these aren't public endpoints):

```bash
# Xero — actually fetches and stores invoices
curl -X POST http://localhost:3000/api/orgs/org123/integrations/xero/sync

# QuickBooks — connects fine, but returns status: "not_implemented" (no SDK yet)
curl -X POST http://localhost:3000/api/orgs/org123/integrations/quickbooks/sync

# Sage — same: status: "not_implemented"
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

**Dispatch:** `dispatchXeroSync()` in `lib/jobs/dispatch.ts` — runs `syncXeroInvoices()`
inline by default (`JOB_PROCESSING_MODE=inline`), or enqueues to the `xero-sync`
pg-boss queue in worker mode

**Worker (worker mode only):** `workers/index.ts`'s `xero-sync` consumer

**Sync Logic:** `lib/integrations/xero.ts` — token refresh prefers the org's
own admin-entered Xero app credentials (`IntegrationConfig.xeroClientId/xeroClientSecret`,
set via the integrations settings page), falling back to the platform-wide
`XERO_CLIENT_ID`/`XERO_CLIENT_SECRET` env vars

**Deduplication:** Uses `XeroSyncLog` table with unique constraint on `(organizationId, invoiceId, lineItemIndex)`

**Anomaly Detection:** After a sync creates new invoices, `dispatchXeroSync()`
checks whether the org's plan includes `invoiceAnomalyDetection` (Enterprise
only) and if so calls `dispatchInvoiceAnomalyDetection()`, which runs
`detectInvoiceAnomalies()` inline the same way

### QuickBooks & Sage (OAuth connect only — sync not implemented)

**Job Types:** `QuickBooksSyncJobData`, `SageSyncJobData` (same shape as Xero)

**Sync routes:** `/api/orgs/[orgId]/integrations/{quickbooks,sage}/sync` call
`syncQuickBooksInvoices()` / `syncSageInvoices()` directly and return
`{ status: "not_implemented", created: 0, updated: 0, skipped: 0 }` — they do
**not** enqueue a job, since there's nothing on the other end to process it

**Sync Logic:** Stub functions in `lib/integrations/quickbooks.ts` and `lib/integrations/sage.ts`
that verify the connection exists and then no-op

**TODO:** Implement actual OAuth token refresh + API calls for QB/Sage SDKs.
Once real fetch logic exists, wire it through `dispatch.ts` the same way Xero is.

## Testing

### Test Manually (Local Development)

With the default `JOB_PROCESSING_MODE=inline`, no separate worker process is
needed — `pnpm dev` alone is enough:

1. Verify Xero is connected for an org (`GET /api/orgs/{orgId}/integrations/xero`)
2. Set `CRON_SECRET` in `.env.local`
3. Call scheduler: `curl -X POST http://localhost:3000/api/admin/schedule/accounting-sync -H "x-cron-secret: <your CRON_SECRET>"`
4. Watch the dev server console for `[scheduler] Ran Xero sync for org ...`
5. Check database: `SELECT * FROM xero_sync_logs ORDER BY created_at DESC LIMIT 10`

Only set `JOB_PROCESSING_MODE=worker` and run `pnpm worker` separately if
you're testing the worker-based path for a deployment that runs one.

### Verify Scheduler (In Production)

1. Set `CRON_SECRET` in Vercel environment
2. Test endpoint: `curl -X POST https://your-app.vercel.app/api/admin/schedule/accounting-sync -H "x-cron-secret: $CRON_SECRET"`
3. Check logs (Vercel → Functions tab) for `[scheduler] Ran Xero sync for org ...`
4. Verify new rows landed: `SELECT COUNT(*) FROM xero_sync_logs WHERE created_at > now() - interval '1 hour'`

## Troubleshooting

**Sync runs but nothing new lands:**
- In the default inline mode there's no queue to check — sync runs
  synchronously inside the scheduler/sync-route request, so an error there
  shows up directly in the response or server logs
- Confirm invoices in Xero are actually in "Authorised" or "Paid" status —
  draft invoices are excluded by `fetchXeroInvoices()`'s where-clause

**Running in worker mode (`JOB_PROCESSING_MODE=worker`) and jobs aren't processing:**
- Verify worker is running: `ps aux | grep 'pnpm worker'`
- Check `pg-boss` table: `SELECT * FROM pgboss.job LIMIT 10`
- Review worker logs for errors

**Anomaly detection not running after a Xero sync:**
- It only runs when the org's plan includes `invoiceAnomalyDetection`
  (Enterprise) — check `PLAN_FEATURES` in `lib/billing/limits.ts`
- In inline mode, check for errors from `detectInvoiceAnomalies()` in the
  same request/server log as the sync itself
- In worker mode, verify a job was queued: `SELECT * FROM pgboss.job WHERE name = 'invoice-anomaly-jobs'`

**Xero OAuth token expired:**
- Verify `xero_token_expires_at` in the `integration_configs` table
- Sync will refresh token automatically (5-minute threshold), using the
  org's own Xero app credentials if configured, otherwise the platform env vars
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
