# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MetricOra is a multi-tenant GHG emissions tracking platform for small-to-mid-market companies. It consists of two client surfaces that share a single Next.js backend API:

- **Web app** (Next.js) — for sustainability managers, finance leads, executives, and auditors: import CSV data, run calculations, review records, publish snapshots, generate reports.
- **Flutter mobile app** (`mobile/`) — for field workers (subcontractors, suppliers, tipper hires): photograph waste tickets/delivery notes, on-device OCR extraction, offline-first submission to the org's review queue.

**Stack:**
- **Frontend/Backend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Auth:** Better Auth (Postgres sessions for web; JWT for Flutter mobile)
- **Database:** PostgreSQL via Prisma ORM. Dev: local Postgres. Prod: Supabase.
- **Queue/Workers:** `pg-boss` — PostgreSQL-based job queue. No Docker. Uses the same Postgres instance.
- **Rate Limiting:** Fixed-window counters backed by Redis (optional) with automatic Postgres fallback. Persists rate limits across serverless cold starts. Recommended for production.
- **Object Storage:** Cloudflare R2 (S3-compatible, free tier — 10 GB/month, zero egress, no credit card). Dev: local filesystem adapter.
- **Email:** Resend (3k/month free, 100/day). Dev: log to console.
- **Push Notifications:** Firebase Cloud Messaging (FCM) — free, Google account only.
- **Document Parsing:** `xlsx` (CSV + Excel), `pdf-parse` (PDFs), `mammoth` (DOCX) — all npm, no Python, no Docker.
- **Emission Factors:** DEFRA 2025 + EPA GHG Hub 2025 + SustainMetrics CSV — seeded into PostgreSQL, zero paid API
- **PDF generation:** Puppeteer (headless Chromium) in the reports worker
- **Validation:** Zod at all API boundaries
- **UI:** shadcn/ui + Tailwind CSS 4 + `motion` (animations)
- **Flutter state:** Riverpod; routing: go_router; HTTP: Dio; offline: drift/SQLite; OCR: google_mlkit_text_recognition (on-device, free, offline)

**No Docker. No paid subscriptions.** One deliberate exception: `api/forecast.py`, a stateless Prophet forecasting function deployed as a Vercel Python Function in this same project (no separate host, no Docker) — see "Forecasting" under Background Jobs below. Everything else is Node/TypeScript.
External accounts required: Supabase (Postgres) + Cloudflare (R2) + Resend (email) + Google (FCM).
Optional: Redis for production rate limiting (recommended but automatic Postgres fallback provided).

## Commands

```bash
# Development
pnpm dev               # Start Next.js dev server
pnpm build             # Production build
pnpm lint              # ESLint
pnpm typecheck         # tsc --noEmit
pnpm test              # Vitest run
pnpm test:watch        # Vitest watch mode
pnpm worker            # Start pg-boss worker process (separate from Next.js, uses same Postgres)

# Database
pnpm prisma migrate dev          # Apply migrations in development
pnpm prisma migrate deploy       # Apply migrations in production
pnpm prisma generate             # Regenerate Prisma client after schema changes
pnpm prisma db seed              # Seed categories + methodology + DEFRA/EPA factor library records

# Flutter (run from mobile/ directory)
cd mobile && flutter run          # Run app on connected device/emulator
cd mobile && flutter test         # Run Flutter unit + widget tests
cd mobile && flutter analyze      # Dart static analysis
cd mobile && flutter build apk    # Android release build
cd mobile && flutter build ipa    # iOS release build

# CI checks (run before pushing)
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Folder Structure

```
app/
  api/
    orgs/[orgId]/          # All org-scoped REST endpoints
      imports/
      activity-records/
      calculation-runs/
      reports/
      dashboard/
      field-submissions/   # Field worker submission intake + review
  (auth)/                  # Sign in, sign up, reset password pages
  (app)/                   # Authenticated web app shell
    orgs/[orgId]/
      dashboard/
      imports/
      records/
      submissions/         # Review queue: incoming field submissions
      calculations/
      reports/
      targets/
      settings/
lib/
  auth/
    index.ts               # Better Auth config (email/password + JWT strategy)
    session.ts             # requireSession(), requireOrgMember() helpers
  db/
    index.ts               # Prisma client singleton
    audit.ts               # writeAuditLog() — append-only, never update rows
  jobs/
    queues/index.ts        # BullMQ queue definitions (imports, calculations, reports, notifications)
  storage/index.ts         # Cloudflare R2 client, presignUpload/Download, key conventions
  validation/
    api.ts                 # handleRouteError(), apiError() — consistent { code, message, details? }
  calculation/
    units.ts               # Canonical unit registry + normalizeUnit()
    factor-selector.ts     # selectFactor() — deterministic, records selection reason
    engine.ts              # computeCo2e() — gas-specific or scalar, stores formula string
prisma/
  schema.prisma            # Canonical schema — all tenant tables include organization_id
  migrations/
  seed.ts                  # Seeds categories, methodology version, DEFRA/EPA library records
workers/
  index.ts                 # BullMQ worker entry point (separate process)
mobile/                    # Flutter project
  lib/
    core/
      api/                 # Dio client, auth interceptor (JWT), endpoint wrappers
      storage/             # drift DB schema, offline sync queue
      router/              # go_router config + auth guard
    features/
      auth/                # Invite link deep link, PIN setup, flutter_secure_storage
      capture/             # Camera, OCR extractor (ocr_extractor.dart), form pre-fill
      submissions/         # Submit flow, status list, offline draft queue
      sync/                # Background sync service
  test/
    capture/               # OCR extractor unit tests (static PNG fixtures, no camera)
    sync/                  # Offline queue tests
```

## Architecture Patterns

### Multi-tenancy
Every tenant-owned table includes `organization_id`. Every query must include an explicit org scope — enforced in `lib/auth/session.ts` via `requireOrgMember()`. Cross-tenant access is a P0 security bug.

Object storage keys follow the convention:
```
org/{orgId}/evidence/{evidenceId}/{filename}
org/{orgId}/imports/{importId}/source.csv
org/{orgId}/imports/{importId}/errors.csv
org/{orgId}/reports/{reportId}/report.pdf
```
All presigned URLs generated server-side after auth checks. Expiry: 1 hour (`PRESIGN_TTL` in `lib/storage/index.ts`, raised from 15 minutes to tolerate slow/interrupted downloads). Never expose raw R2 keys to clients.

### API Routes
- Validate all input with Zod before touching the database.
- Return `{ code, message, details? }` for all errors via `handleRouteError()` in `lib/validation/api.ts`.
- Use cursor pagination by default on list endpoints.
- Accept idempotency keys on imports, calculation runs, and report generation. Store business keys (`source_checksum`, `trigger_hash`, `request_hash`) in the database to detect duplicates before enqueuing.

### Authorization (RBAC)
Six roles: `admin | editor | reviewer | viewer | auditor | field_worker`.

`field_worker` is for external parties (subcontractors, suppliers). They can only submit field submissions and view their own submission status — zero access to org dashboards, calculations, or other users' data.

Enforce server-side on every org-scoped request via `requireOrgMember(orgId, ...allowedRoles)` in `lib/auth/session.ts`. Never derive authorization from client-supplied headers or body fields.

### Auth: Dual Strategy
- **Web:** Cookie-based sessions (Better Auth default)
- **Flutter mobile:** JWT access tokens stored in `flutter_secure_storage`. Better Auth `/api/auth/token` endpoint. Auto-refresh on 401 via Dio interceptor.
- **Field worker onboarding:** Admin generates an `InviteLink` (signed token, expires). Field worker opens deep link → Flutter app → sets PIN → immediately in submission mode. No email/password required.

### Background Jobs (pg-boss)
Uses `pg-boss` — a PostgreSQL-backed job queue. No Redis, no Docker, no extra infrastructure. The same Postgres instance used for app data handles the job queue via `SELECT FOR UPDATE SKIP LOCKED`.

**Deployment reality: this project runs on Vercel only, with no separate host running `workers/index.ts` continuously.** Vercel serverless functions cannot run a persistent pg-boss consumer, so a queue with no other consumer is a queue nothing ever drains. `lib/jobs/dispatch.ts` is the load-bearing piece that makes this work anyway: `dispatchImport()`, `dispatchCalculation()`, `dispatchReport()`, `dispatchNotification()`, `dispatchDsarExport()`, `dispatchDsarErasure()`, and `dispatchForecast()` each check `JOB_PROCESSING_MODE` (env var, defaults to `"inline"`) — in `inline` mode (the only mode that actually works on Vercel-only) the job runs synchronously inside the API route's request/response cycle instead of being enqueued; in `worker` mode it enqueues to pg-boss as normal, for a deployment that *does* run a separate worker process. **Always call a route through its `dispatchX()` function, never `enqueueX()`/`boss.send()` directly** — a route that enqueues without going through `dispatch.ts` will silently never run on this deployment. Several older queues (`invoice-anomaly`, `xero-sync`, `quickbooks-sync`, `supplier-performance`, `dbt-transform`, `causal-analysis`) predate this pattern and do **not** have an inline fallback — treat anything that only calls `enqueueX()` as dead code on the current deployment until it's added to `dispatch.ts` the same way.

Core queues: `imports`, `calculations`, `reports`, `notifications`, `forecasting`.

All jobs must be idempotent and retryable (3 attempts, exponential backoff). Store job status in DB (`ImportBatch.state`, `CalculationRun.status`, `Report.status`).

Import state machine:
```
uploaded → parsing → validating → needs_attention | ready_to_commit → committed | failed
```

**Document parsing (npm, no Python):**
- `xlsx` — CSV and Excel (.xlsx/.xls) import templates
- `pdf-parse` — PDF utility bills and delivery notes
- `mammoth` — DOCX documents to plain text

Called from the `imports` worker, not a separate service.

**Forecasting (`lib/jobs/workers/forecasting.ts`):** tries Prophet first via `api/forecast.py` (a stateless Vercel Python Function — takes a `{date, value}` series in, returns predictions plus a genuine holdout-backtested accuracy, no DB access of its own) and falls back to the pure-TypeScript engine (`lib/forecasting/engine.ts`, exponential smoothing / seasonal decomposition) on any failure — network error, timeout, service unavailable. Never fails the whole forecast because Python is unreachable. `FORECAST_SERVICE_SECRET` (optional) gates the Python endpoint so only this app's own worker code can call it.

### Calculation Engine (`lib/calculation/`)
Pipeline for each `CalculationRun`:
1. Select target `ActivityRecord` rows for org + period + status.
2. `normalizeUnit()` — convert to canonical unit, store both original and normalized.
3. `selectFactor()` — matches category, geography, date, scope-2 method; records selection reason.
4. `computeCo2e()` — gas-specific (`CO2 + CH4×GWP + N2O×GWP`) or scalar; stores formula string.
5. Persist immutable `EmissionCalculation` rows — **never update them**.
6. Rebuild `DashboardAggregate` rows for the snapshot.

GWP values (AR6): CH4 = 27.9, N2O = 273.

Published snapshots are immutable. Recalculation creates a new `CalculationRun` + `PublishedSnapshot` version. Users must see a diff before replacing a published report.

### Flutter: Field Capture Flow
```
1. Open app → select assigned project
2. Choose: Waste Ticket | Delivery Note | Fuel Receipt | Other
3. Camera → photograph document
4. On-device ML Kit OCR (~1–2s, offline capable)
5. ocr_extractor.dart extracts: weight, EWC code, date, vehicle reg, supplier
6. Pre-filled form — user reviews/corrects
7. GPS auto-tag (optional)
8. Submit → saved to drift/SQLite first, synced in background when online
9. Status: pending → syncing → submitted → approved/rejected
```

### Offline Sync Pattern
Submissions are always written to local SQLite (`drift`) first. A background sync `Isolate` drains the queue when `connectivity_plus` detects a network. Server returns idempotency-safe responses.

### Polymorphic Relations
`ReviewTask.targetId` and `Comment.targetId` are polymorphic references (resolved in application code, not via Prisma FK relations). Query the specific resource table after reading `targetType`.

### Reporting
Reports generated asynchronously from a `PublishedSnapshot` using Puppeteer. Report totals must match dashboard totals for the same snapshot — this is a core trust invariant. Generated PDFs/CSVs stored in R2 with checksums. Download links are 1-hour signed URLs.

### Audit Log
`AuditLog` is append-only via `writeAuditLog()` in `lib/db/audit.ts`. Never update or delete rows. Required events: auth, role changes, imports, record mutations, factor imports, calculation runs, snapshot publication, report publication, field submission submission/review.

## Domain Model (Key Tables)

See `prisma/schema.prisma` for canonical definitions.

- `Organization` → owns everything tenant-scoped.
- `ActivityRecord` → committed activity data. References `ReportingPeriod`, `EmissionCategory`, optional `Facility`, `BusinessUnit`, `ImportBatch`.
- `FieldSubmission` → draft submitted by field workers, reviewed by org members. Approved submissions become `ActivityRecord` rows.
- `EmissionCalculation` → immutable output per record per run. Denormalizes `factor_library_version` and `methodology_version_name` for audit robustness.
- `PublishedSnapshot` → links a `ReportingPeriod` to a `CalculationRun`. Dashboards and reports read from this.
- `DashboardAggregate` → pre-computed totals rebuilt after each calculation run. **Never query raw `EmissionCalculation` rows for dashboards.**
- `ImportBatch` + `StagedActivityRecord` → staging area. Staged rows are separate from committed `ActivityRecord` rows; no partial commits.
- `AuditLog` → append-only; no `updated_at`.
- `InviteLink` → time-limited tokens for field worker onboarding via deep link.

## Emissions Categories (MVP — seeded, no per-org custom categories)

- Scope 1: `s1-stationary`, `s1-mobile`, `s1-fugitive`
- Scope 2: `s2-electricity-lb` (location-based), `s2-electricity-mb` (market-based)
- Scope 3: `s3-business-travel`, `s3-commuting`, `s3-purchased-goods`, `s3-upstream-transport`

## Emission Factor Sources (Zero Cost)

| Library | Source | Format |
|---|---|---|
| DEFRA 2025.1 | gov.uk conversion factors | XLSX download |
| EPA 2025.1 | epa.gov GHG Emission Factors Hub | PDF → manual CSV |
| SustainMetrics | sustainmetrics.net/factors | CSV, free download, no signup |

Library records are seeded; actual factor rows loaded via admin import. Methodology: `ghg-protocol-v2026-01`, GWP AR6.

## Testing

- **Unit tests:** `lib/calculation/` (units, factor selection, engine formula). `mobile/test/capture/` (OCR extractor with static PNG fixtures).
- **API tests:** auth flows, RBAC boundaries (all six roles), org scoping, import pipeline, field submission flow.
- **Integration tests:** import → commit → calculate → dashboard → publish → report.
- **Security regression tests:** cross-tenant access attempts (P0 — must not regress). `field_worker` role must not access org aggregates.

Use deterministic fixture factor libraries. Do not use real customer evidence files in tests.

## Performance Constraints

- Dashboard load < 3s for orgs with up to 100k activity records → use `DashboardAggregate`, never raw aggregation at request time.
- CSV imports up to 25k rows must process asynchronously.
- Stream large exports; never load an entire org dataset into memory.
- Required indexes on `ActivityRecord`: `(organization_id, reporting_period_id, category_id, facility_id, review_status, created_at)`.

## External Services (Free Accounts, No Docker)

All services are free tier, no credit card required except Cloudflare R2.

### Supabase (production database)
- PostgreSQL database hosted on Supabase (supabase.com)
- Connection: Set `DATABASE_URL` in `.env` with Supabase connection string
- For local dev, install Postgres natively or use Supabase CLI for local development
- Supabase provides: Postgres, real-time subscriptions, auth (optional), vector/pgvector support
- For production migrations: `pnpm prisma migrate deploy`

### Cloudflare R2 (object storage)
- Free tier: 10 GB/month, zero egress fees, S3-compatible API
- Keys: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`
- For local dev, `STORAGE_DRIVER=local` writes to `./uploads/` instead

### Resend (transactional email)
- Sign up at resend.com — free tier: 3,000 emails/month, 100/day
- Used for: org invites, task assignments, import failure alerts, report ready notifications
- For local dev, set `EMAIL_DRIVER=console` to log emails instead of sending
- Set `RESEND_API_KEY` in `.env`

### Firebase Cloud Messaging (push notifications — Flutter)
- Free, requires a Google account + Firebase project
- Flutter: `firebase_messaging` package handles FCM token registration
- Server: `firebase-admin` npm package sends push from the notifications worker
- Set `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env`

### Redis (optional but recommended for production rate limiting)
- Sign up at upstash.com, aws.amazon.com (ElastiCache), heroku.com, or redis.com — free or low-cost managed options
- Used by: Rate limiting for API endpoints (`lib/security/rate-limit-async.ts`) with automatic Postgres fallback
- Rate limit buckets persist across serverless cold starts (essential for Vercel/Cloudflare Workers deployments)
- Connection: Set `REDIS_URL` in `.env` — format: `redis://[:password@]host:port` or `rediss://...` for TLS
- For local dev, leave `REDIS_URL` unset — rate limiting falls back to Postgres automatically
- Admin monitoring: Check rate limiter health at `GET /api/admin/health/rate-limiter` (returns status, Redis latency, fallback reason)

### DocuSeal (optional, post-MVP)
For digital signing of supplier declarations and audit reports. Can be added later — for MVP, a consent checkbox replaces document signing. See https://github.com/docusealco/docuseal when ready.

## Claude Code Skills

Skills live in `.claude/skills/` and can be invoked as slash commands.

| Skill | Invoke | Purpose |
|---|---|---|
| `taste-skill` | `/taste-skill` | Anti-slop UI checklist, design dials, hard bans (no em-dashes, etc.) |
| `emil-design-eng` | `/emil-design-eng` | Animation decision framework, component micro-interactions |
| `karpathy-principles` | `/karpathy-principles` | Think before coding, simplicity, surgical changes |
| `ui-ux-pro-max` | `/ui-ux-pro-max` | 10-priority design system generator for web + Flutter |
| `impeccable` | Install via `npx impeccable install` | 23-command design audit (https://github.com/pbakaus/impeccable) |
| `graphify` | `/graphify` | Turn any folder into a queryable knowledge graph — architecture, file relationships, community detection |

`graphify` requires the CLI: `uv tool install graphifyy && graphify install --platform claude` (one-time per machine).

`motion` (https://github.com/motiondivision/motion) is an npm dependency, not a skill. Add as `motion` to `package.json` — it is the animation library for the web app.

## Open Decisions (Resolve Before Production)

1. **Emission factor dataset licensing** — confirm DEFRA/EPA redistribution terms for production.
2. **Methodology versioning policy** — when does `ghg-protocol-v2026-01` increment and how are customers notified.
3. **Billing** — required at first production launch (affects org model, gating, trial flows).
4. **Primary report format** — auditor package vs. customer disclosure vs. internal executive summary.
5. **Currency exchange rates** — spend-based Scope 3 uses approximations in `lib/calculation/units.ts`; use live rates in production.
