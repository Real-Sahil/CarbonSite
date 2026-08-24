# CarbonSite

A multi-tenant GHG emissions tracking platform for small-to-mid-market companies. Field workers photograph waste tickets and delivery notes; sustainability managers import data, run calculations, and publish reports—all with immutable audit trails.

**No Docker. No Redis. No Python services. Zero paid subscriptions.**

## Key Features

✅ **Multi-Tenant Isolation** — Org-scoped queries, role-based access (6 roles: admin, editor, reviewer, viewer, auditor, field_worker)

✅ **Field Mobile App** — Flutter app with on-device OCR, offline-first submission, sync when online

✅ **Calculation Engine** — GHG Protocol-compliant, immutable calculations with audit trail

✅ **Zero-Cost Infrastructure** — PostgreSQL (Neon free), Cloudflare R2 (free tier), Resend email (3k/month free), Firebase FCM (free)

✅ **Async Job Queue** — PostgreSQL-backed pg-boss (no Redis needed)

✅ **PDF Reports** — Puppeteer-powered report generation from snapshots

✅ **Emission Factor Library** — DEFRA 2025 + EPA 2025 + SustainMetrics (seeded into DB, free)

## Quick Start

### Development

```bash
# Install & setup
pnpm install
cp .env.example .env
# Edit .env with Postgres connection

# Create database & migrate
pnpm prisma migrate dev

# Start services (3 terminals)
pnpm dev              # Web server (localhost:3000)
pnpm worker           # Async job worker (separate process)
pnpm test:watch       # Tests in watch mode
```

### Deployment

```bash
# Vercel (recommended for Next.js)
vercel deploy --prod

# Manual
pnpm build && pnpm start  # Web
pnpm worker               # Worker (separate)
```

See [`docs/operators.md`](docs/operators.md) for detailed deployment steps.

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| **Frontend/Backend** | Next.js 16 + React 19 | App Router, type-safe |
| **Database** | PostgreSQL + Prisma | Neon (free), single source of truth |
| **Job Queue** | pg-boss (PostgreSQL) | No Redis, immutable job history |
| **Storage** | Cloudflare R2 | Free tier, S3-compatible, zero egress |
| **Email** | Resend | 3k/month free, transactional only |
| **Push Notifications** | Firebase FCM | Free, Google account only |
| **Mobile** | Flutter + Riverpod | Offline-first, on-device OCR |
| **Validation** | Zod | Runtime & compile-time safety |
| **UI** | shadcn/ui + Tailwind CSS 4 | Headless components, no bloat |

## Documentation

### For Developers
- **[`docs/developers.md`](docs/developers.md)** — Feature development workflow, patterns, testing
- **[`docs/api-examples.md`](docs/api-examples.md)** — cURL & JavaScript examples for all endpoints
- **[`docs/emissions-walkthrough.md`](docs/emissions-walkthrough.md)** — Real calculation examples with DEFRA/EPA factors
- **[`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)** — Code review standards, commit guidelines

### For Operations
- **[`docs/operators.md`](docs/operators.md)** — Deployment, monitoring, scaling, incident response
- **[`docs/operations-runbook.md`](docs/operations-runbook.md)** — Common operational tasks
- **[`CLAUDE.md`](CLAUDE.md)** — Project architecture, decisions, external services

### For Product
- **[`docs/production-roadmap.md`](docs/production-roadmap.md)** — Roadmap and feature planning
- **[`docs/FLUID-PRD.md`](docs/FLUID-PRD.md)** — Product requirements document

## Project Structure

```
app/
  api/orgs/[orgId]/     # All org-scoped REST endpoints
  (auth)/               # Sign in, sign up, password reset
  (app)/                # Authenticated web app shell

lib/
  auth/                 # Better Auth config, session helpers
  db/                   # Prisma client, audit logging
  jobs/                 # pg-boss queue definitions
  calculation/          # Emission calculation engine
  storage/              # Cloudflare R2 client
  validation/           # Zod schemas, error handling

prisma/
  schema.prisma         # Canonical DB schema (all tables include organization_id)
  migrations/           # Reversible migrations
  seed.ts               # Seed categories, methodology, factor library

workers/
  index.ts              # pg-boss worker entry point

mobile/                 # Flutter app
  lib/
    core/api/           # Dio HTTP client, JWT auth
    features/capture/   # Camera, OCR extractor
    features/sync/      # Offline sync, drift DB
```

## Key Concepts

### Multi-Tenancy
Every tenant-owned table includes `organization_id`. Every query must scope to an org—this is enforced server-side via `requireOrgMember(orgId, roles)`.

```typescript
// ✅ CORRECT: Org-scoped
const records = await db.activityRecord.findMany({
  where: { organization_id: orgId },
});

// ❌ WRONG: Missing org scope (security bug)
const records = await db.activityRecord.findMany({});
```

### Emission Calculations
1. **Normalize units** (m³ → kWh, km → litres)
2. **Select factor** (DEFRA 2025, geography, date, scope)
3. **Compute CO2e** (gas-specific with GWP, or scalar)
4. **Store immutably** (calculations never updated)

See [`docs/emissions-walkthrough.md`](docs/emissions-walkthrough.md) for detailed examples.

### Job Queue (pg-boss)
Four queues: `imports`, `calculations`, `reports`, `notifications`.

```typescript
// Enqueue from API
await importQueue.send({
  organization_id: orgId,
  batch_id: batchId,
});

// Worker subscribes
importQueue.subscribe(async (job) => {
  await processImport(job.data);
  await job.done();
});
```

## Commands

```bash
# Development
pnpm dev               # Start Next.js dev server
pnpm worker            # Start pg-boss worker (separate terminal)
pnpm test              # Run tests once
pnpm test:watch         # Watch mode
pnpm lint              # ESLint + fixes
pnpm typecheck         # TypeScript check
pnpm build             # Production build

# Database
pnpm prisma migrate dev      # Create migration (interactive)
pnpm prisma migrate deploy   # Apply pending migrations
pnpm prisma generate         # Regenerate Prisma client
pnpm prisma db seed          # Seed categories + factors

# Useful queries
sqlite3 .env            # View env vars
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/carbonsite

# Authentication
BETTER_AUTH_SECRET=<random-32-char-string>
BETTER_AUTH_TRUST_HOST=true

# Email (Resend)
RESEND_API_KEY=re_<your-key>
EMAIL_FROM=noreply@carbonsite.com

# Storage (Cloudflare R2)
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET=carbonsite
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com

# Push Notifications (Firebase)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Application
NODE_ENV=production
PORT=3000
```

## Security

- **Multi-tenancy:** Organization ID enforced on all queries via `requireOrgMember()`
- **RBAC:** Six role levels with granular permissions
- **Input validation:** Zod schemas at all API boundaries
- **Audit logging:** Append-only logs for compliance
- **Immutability:** Calculations never updated (audit trail preserved)
- **Secrets:** Never hardcoded; use environment variables

## Testing

```bash
# All tests must pass before committing
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# Test coverage
pnpm test -- --coverage

# Specific test file
pnpm test lib/calculation/engine.test.ts
```

Test guidelines:
- Unit tests for calculation logic (100% coverage)
- Integration tests for API workflows (80%+ coverage)
- Security tests for RBAC (100% role combinations)
- Use deterministic fixture data (no real customer data)

See [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) for test standards.

## Performance

- **Dashboard load:** < 3 seconds for 100k records (uses `DashboardAggregate` materialized rows)
- **CSV import:** 25k rows asynchronously via pg-boss worker
- **Report generation:** Async via Puppeteer, stored in R2

Required indexes: See `prisma/schema.prisma` comments.

## External Services (Free Tier)

| Service | Cost | Used For | Sign-Up |
|---|---|---|---|
| **Neon PostgreSQL** | 0.5 GB free | Database | neon.tech |
| **Cloudflare R2** | 10 GB/month free | Object storage | cloudflare.com |
| **Resend** | 3k/month free | Email | resend.com |
| **Firebase** | Free tier | Push notifications | firebase.google.com |
| **Vercel** | Free tier | Hosting | vercel.com |

## Emission Factor Sources

| Library | Year | Format | License |
|---|---|---|---|
| DEFRA | 2025 | XLSX → CSV | Crown Copyright (check redistribution) |
| EPA GHG Hub | 2025 | PDF → CSV | Public domain |
| SustainMetrics | Ongoing | CSV | Free download, no signup |

All seeded into PostgreSQL at deployment. See `prisma/seed.ts`.

## Roadmap

Current focus (MVP):
- ✅ Web app: import, calculate, publish, report
- ✅ Mobile app: field capture with OCR, offline sync
- ✅ Multi-tenant isolation & RBAC
- ✅ Audit logging
- ⏳ Graphify knowledge graph automation
- ⏳ Production deployment hardening

Future (post-MVP):
- Billing model (freemium, per-org, usage-based?)
- Report templates (auditor package, customer disclosure, executive summary)
- Custom emission factors (org-specific)
- API access for integrations (ERP, accounting software)
- Data retention policies & GDPR workflows

See [`docs/production-roadmap.md`](docs/production-roadmap.md) for details.

## Open Decisions

Before production launch, resolve:

1. **Billing Model** — Freemium? Per-org? Per-record? Usage-based?
2. **Report Format** — Auditor package vs. customer disclosure vs. executive summary?
3. **Data Retention** — How long to keep audit logs, calculations, reports?
4. **Methodology Versioning** — When does GHG Protocol version increment?
5. **Factor Updates** — Frequency and process for DEFRA/EPA updates?
6. **Mobile Licensing** — Licensing model for Flutter app distribution?

See `CLAUDE.md` for decision context.

## Contributing

1. Read [`docs/developers.md`](docs/developers.md)
2. Follow [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)
3. Create feature branch: `git checkout -b feature/your-feature`
4. Make changes, commit locally
5. Run full test suite: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
6. Push and open PR

## License

Copyright 2025. See LICENSE file.

## Support

- **Questions?** Check the [documentation](docs/)
- **Found a bug?** [Open an issue](https://github.com/Real-Sahil/CarbonSite/issues)
- **Want to contribute?** See [CONTRIBUTING.md](.github/CONTRIBUTING.md)

---

**Questions about this README?** See [`docs/developers.md`](docs/developers.md) or [`CLAUDE.md`](CLAUDE.md).
