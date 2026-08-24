# Operators Guide: Deployment, Monitoring & Scaling

This guide is for DevOps engineers, operations staff, and anyone managing CarbonSite infrastructure.

## Pre-Deployment Checklist

Before deploying to production, verify:

### Infrastructure
- [ ] PostgreSQL instance provisioned (Neon free tier or self-hosted)
  - Minimum: 0.5 GB storage (Neon free), 100 compute-hours/month
  - Verify connection string: `postgresql://user:password@host:5432/carbonsite`
- [ ] Cloudflare R2 bucket created (free tier: 10 GB/month, zero egress)
  - Keys: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`
- [ ] Resend account active (free: 3,000 emails/month, 100/day)
  - Key: `RESEND_API_KEY`
- [ ] Firebase project created for FCM (free, Google account only)
  - Key: `FIREBASE_SERVICE_ACCOUNT_JSON` (service account JSON)
- [ ] Domain and SSL certificate (Vercel provides auto-SSL)

### Application
- [ ] All tests passing: `pnpm lint && pnpm typecheck && pnpm test`
- [ ] Production build succeeds: `pnpm build`
- [ ] Environment variables set (see `.env.example`)
- [ ] Database migrations current: `pnpm prisma migrate deploy`
- [ ] Seed data loaded: `pnpm prisma db seed`
- [ ] Git history clean, no uncommitted changes

### Security
- [ ] No secrets in code or git history
- [ ] API keys rotated (first deployment)
- [ ] CORS configured for your domain
- [ ] Rate limiting enabled
- [ ] HTTPS enforced (redirect HTTP → HTTPS)

### Data
- [ ] Backup strategy documented
- [ ] Retention policy decided (audit logs, activity records)
- [ ] GDPR/compliance review completed
- [ ] Data classification documented

## Production Deployment

### Vercel (Recommended for Next.js)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Link project
vercel link

# 3. Set environment variables
vercel env add DATABASE_URL "postgresql://..."
vercel env add RESEND_API_KEY "re_..."
vercel env add R2_ACCESS_KEY_ID "..."
# (Add all vars from .env.example)

# 4. Deploy
vercel deploy --prod

# 5. Run migrations on production DB
vercel env pull .env.production.local
export $(cat .env.production.local | xargs)
pnpm prisma migrate deploy

# 6. Seed production data (first deployment only)
pnpm prisma db seed
```

### Monitoring Deployment

```bash
# Watch deployment logs
vercel logs

# Check build status
vercel status

# Rollback if needed
vercel rollback
```

### Traditional Server Deployment (Self-Hosted)

```bash
# 1. Clone and install
git clone https://github.com/Real-Sahil/CarbonSite
cd CarbonSite
pnpm install --production

# 2. Build
pnpm build

# 3. Set environment
export DATABASE_URL="postgresql://..."
export NODE_ENV=production
# (Set all vars from .env.example)

# 4. Run migrations
pnpm prisma migrate deploy

# 5. Start web process (use PM2 or systemd)
pm2 start "pnpm start" --name carbonsite-web

# 6. Start worker process (separate, required!)
pm2 start "pnpm worker" --name carbonsite-worker

# 7. Verify both processes running
pm2 list
```

## Running the Application

### Web Process
Handles HTTP requests, API endpoints, authentication.

```bash
pnpm dev      # Development
pnpm start    # Production
```

Listens on port 3000 by default. Configure with `PORT` environment variable.

### Worker Process
Handles background jobs (imports, calculations, reports, notifications).

**This is required for the application to function.** Without the worker, queued jobs pile up.

```bash
pnpm worker   # Starts pg-boss subscriber
```

Run in a separate process/container. It connects to the same PostgreSQL database as the web process.

### Job Queue (pg-boss)

Queues live in PostgreSQL (no Redis required):

| Queue | Purpose | Typical Duration |
|---|---|---|
| `imports` | CSV/Excel/PDF parsing and validation | 1-30 seconds |
| `calculations` | CO2e computation for activity records | 5-300 seconds |
| `reports` | PDF generation from snapshots | 10-120 seconds |
| `notifications` | Email and push notifications | 1-5 seconds |

Monitor queue depth:

```sql
SELECT queue_name, COUNT(*) as pending_jobs
FROM pgboss.job
WHERE state = 'created'
GROUP BY queue_name;
```

## Monitoring & Alerting

### Key Metrics to Track

| Metric | Target | Alert Threshold |
|---|---|---|
| **API Response Time (p95)** | < 500ms | > 2000ms for 5 min |
| **Error Rate** | < 0.1% | > 1% for 5 min |
| **Database Connection Pool** | < 80% used | > 90% |
| **Database Query Time (p95)** | < 100ms | > 500ms for 5 min |
| **Job Queue Depth** | < 100 pending | > 1000 for 10 min |
| **Job Failure Rate** | < 1% | > 5% |
| **Storage (R2)** | < 50% quota | > 80% usage |
| **Email (Resend)** | < 50% quota | > 80% (100/day) |
| **Uptime** | 99.9% | < 99% SLA breach |

### Application Logging

The app logs to stdout. Aggregate with your logging service (Vercel, CloudWatch, DataDog, etc.):

```typescript
// Logs in any route handler
console.log('Event:', { orgId, action, timestamp });
console.error('Error:', { code, message, stack });
```

**Important events to log:**
- Authentication: sign-in, sign-up, session expiry
- Authorization failures (403)
- Calculation runs (start, completion, errors)
- Job queue events (enqueued, completed, failed)
- Data imports (started, rows parsed, validation errors, committed)
- Report generation (started, PDF created, email sent)

### Database Monitoring

Query performance:

```sql
-- Slow queries (> 1s)
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC;

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0;  -- Unused indexes
```

Required indexes exist in schema (`prisma/schema.prisma`). Monitor index bloat:

```sql
SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Scaling Considerations

### At 10k Organizations (1 record per org average)

**Expected resource usage:**
- Database: 50 MB storage, < 5 connections avg
- Worker: < 100ms per import job

**Risks:** None yet.

### At 100k Organizations (1k records per org average)

**Expected resource usage:**
- Database: 500 MB storage, 10-20 connections avg
- Worker: 2-5 seconds per import job (25k row imports)
- Storage (R2): 100 GB (if saving all PDFs)

**Optimizations needed:**
1. Add indexes on frequently queried columns (already in schema)
2. Implement query result caching (Redis or in-process)
3. Batch report generation (process multiple orgs at once)

**Monitor:**
- Connection pool exhaustion
- Dashboard query time (should stay < 3s)
- Import parsing time (should stay < 30s for 25k rows)

### At 1M Records Across All Orgs

**Expected resource usage:**
- Database: 5+ GB storage, 50+ concurrent connections
- Worker: 30+ seconds per 25k-row import

**Required changes:**
1. Implement cursor pagination on list endpoints (already done)
2. Add materialized views for dashboard aggregates (consider if queries slow)
3. Shard job queue by organization (currently single queue)
4. Archive old audit logs (implement retention policy)
5. Consider read replicas for reporting queries

**Scale limits:**
- Single PostgreSQL instance: ~10-50M records before hitting query latency
- Single worker process: ~100 concurrent jobs before throughput degrades
- R2 storage: No practical limit (10 GB/month free, then paid)

## Incident Response

### Application Won't Start

```bash
# 1. Check environment variables
env | grep -E "DATABASE_URL|NODE_ENV|RESEND_API_KEY"

# 2. Verify database connection
psql $DATABASE_URL -c "SELECT version();"

# 3. Check recent commits
git log --oneline -10

# 4. Review build logs
pnpm build

# 5. Rollback if needed
git revert <bad-commit>
pnpm build && pnpm start
```

### High Error Rate

```bash
# 1. Check logs for pattern
vercel logs | grep ERROR | tail -20

# 2. Check database
SELECT COUNT(*) FROM pg_stat_activity;  -- Connection pool exhaustion?
SELECT * FROM pgboss.job WHERE state = 'failed' LIMIT 10;  -- Job failures?

# 3. Check external services
# - Resend API status
# - Cloudflare R2 status
# - Firebase FCM status

# 4. Restart worker if job queue backing up
kill <worker-pid>
pnpm worker &
```

### Database Connection Pool Exhausted

```bash
# 1. Identify long-running queries
SELECT pid, query, query_start 
FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY query_start;

# 2. Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE idle_in_transaction 
AND query_start < now() - INTERVAL '5 minutes';

# 3. Check Prisma pool settings
# Connection pool size in DATABASE_URL:
# postgresql://user:password@host/db?schema=public&pool_size=5

# 4. Increase pool size if needed (restart app)
```

### Job Queue Backing Up

```bash
# 1. Check queue depth
SELECT queue_name, COUNT(*) FROM pgboss.job WHERE state = 'created' GROUP BY queue_name;

# 2. Check for infinite retry loops
SELECT id, queue_name, retry_count, data FROM pgboss.job 
WHERE state = 'failed' AND retry_count > 10;

# 3. Check worker logs
pm2 logs carbonsite-worker | tail -50

# 4. Restart worker
pm2 restart carbonsite-worker

# 5. If still backing up, scale worker (run multiple instances)
```

## Backup & Recovery

### Database Backups

**Neon (managed):**
- Automatic daily backups, 7-day retention
- Restore via Neon dashboard

**Self-hosted PostgreSQL:**
```bash
# Daily backup to file
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Or backup to S3
pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://backups/carbonsite_$(date +%Y%m%d).sql.gz
```

### Knowledge Graph Backups

The graphify knowledge graph is stored in version control (`graphify-out/`). No separate backup needed.

### Restore from Backup

```bash
# From SQL dump
psql $DATABASE_URL < backup_20250101.sql

# Verify data integrity
SELECT COUNT(*) FROM activity_record;
SELECT COUNT(*) FROM emission_calculation;
```

## Routine Maintenance

### Daily
- Monitor error logs for patterns
- Check job queue depth < 100
- Verify worker process running

### Weekly
- Review slow query logs
- Check storage usage (R2, database)
- Confirm backups completed

### Monthly
- Test backup/restore procedure
- Review and rotate API keys if needed
- Analyze database growth rate
- Plan for scaling if approaching limits

### Quarterly
- Full security review
- Compliance check (GDPR, SOX, etc.)
- Performance tuning based on metrics
- Update dependencies

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/carbonsite

# Auth & Security
BETTER_AUTH_SECRET=<random-32-char-string>
BETTER_AUTH_TRUST_HOST=true

# Email (Resend)
RESEND_API_KEY=re_<your-key>
EMAIL_FROM=noreply@carbonsite.com
EMAIL_DRIVER=resend          # or 'console' for dev logging

# Storage (Cloudflare R2)
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET=carbonsite
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_DRIVER=r2            # or 'local' for dev filesystem

# Push Notifications (Firebase)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","..."}'

# Application
NODE_ENV=production
PORT=3000
```

## Rollback Procedures

### If Latest Deployment Has Issues

```bash
# Vercel
vercel rollback  # Reverts to previous deployment

# Manual deployment
git revert <commit-hash>
git push origin main
pnpm build && pnpm deploy
```

### If Database Migrations Break App

```bash
# Identify which migration failed
pnpm prisma migrate status

# Rollback one migration
pnpm prisma migrate resolve --rolled-back <migration-name>

# Fix the migration file, reapply
pnpm prisma migrate deploy
```

## Security Hardening

### HTTPS & CORS
```typescript
// Configure in Next.js
const corsOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? ['https://yourdomain.com'];

// Enforce HTTPS redirect
if (process.env.NODE_ENV === 'production') {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}
```

### Rate Limiting
```typescript
// Implement rate limiting on authentication endpoints
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 requests per windowMs
});

app.post('/api/auth/signin', limiter, handleSignIn);
```

### API Key Rotation
```bash
# Rotate Resend API key monthly
vercel env rm RESEND_API_KEY
vercel env add RESEND_API_KEY "re_<new-key>"
vercel deploy --prod
```

## Resources

- **Developer Guide:** `docs/developers.md`
- **API Examples:** `docs/api-examples.md`
- **Emissions Calculation:** `docs/emissions-walkthrough.md`
- **Tech Stack:** `CLAUDE.md` (repository root)
- **Production Setup:** `docs/production-setup-migration.sql`
- **Operations Runbook:** `docs/operations-runbook.md`
