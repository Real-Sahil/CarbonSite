# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CarbonSite is a multi-tenant GHG emissions tracking platform for small-to-mid-market companies. It consists of two client surfaces that share a single Next.js backend API:

- **Web app** (Next.js) — for sustainability managers, finance leads, executives, and auditors: import CSV data, run calculations, review records, publish snapshots, generate reports.
- **Flutter mobile app** (`mobile/`) — for field workers (subcontractors, suppliers, tipper hires): photograph waste tickets/delivery notes, on-device OCR extraction, offline-first submission to the org's review queue.

**Stack:**
- **Frontend/Backend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Auth:** Better Auth (Postgres sessions for web; JWT for Flutter mobile)
- **Database:** PostgreSQL via Prisma ORM
- **Queue/Workers:** BullMQ + Redis (`workers/index.ts` — separate process)
- **Object Storage:** Cloudflare R2 (S3-compatible, free tier — 10 GB/month, zero egress). Self-hosted alternative: Garage or RustFS.
- **Emission Factors:** DEFRA 2025 + EPA GHG Hub 2025 + SustainMetrics CSV — seeded into PostgreSQL, zero paid API
- **PDF generation:** Puppeteer (headless Chromium) in the reports worker
- **Validation:** Zod at all API boundaries
- **UI:** shadcn/ui + Tailwind CSS 4
- **Flutter state:** Riverpod; routing: go_router; HTTP: Dio; offline: drift/SQLite; OCR: google_mlkit_text_recognition (on-device, free, offline)

## Commands

```bash
# Development
pnpm dev               # Start Next.js dev server
pnpm build             # Production build
pnpm lint              # ESLint
pnpm typecheck         # tsc --noEmit
pnpm test              # Vitest run
pnpm test:watch        # Vitest watch mode
pnpm worker            # Start BullMQ worker process (separate from Next.js)

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
All presigned URLs generated server-side after auth checks. Expiry: 15 minutes. Never expose raw R2 keys to clients.

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

### Background Jobs (BullMQ)
Four queues: `imports`, `calculations`, `reports`, `notifications`. Connection: URL string to avoid ioredis version conflicts.

All jobs must be idempotent and retryable (3 attempts, exponential backoff). Store job status in DB (`ImportBatch.state`, `CalculationRun.status`, `Report.status`). Web process only enqueues — never performs long-running work inline.

Import state machine:
```
uploaded → parsing → validating → needs_attention | ready_to_commit → committed | failed
```

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
Reports generated asynchronously from a `PublishedSnapshot` using Puppeteer. Report totals must match dashboard totals for the same snapshot — this is a core trust invariant. Generated PDFs/CSVs stored in R2 with checksums. Download links are 15-minute signed URLs.

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

## Open Decisions (Resolve Before Production)

1. **Emission factor dataset licensing** — confirm DEFRA/EPA redistribution terms for production.
2. **Methodology versioning policy** — when does `ghg-protocol-v2026-01` increment and how are customers notified.
3. **Billing** — required at first production launch (affects org model, gating, trial flows).
4. **Primary report format** — auditor package vs. customer disclosure vs. internal executive summary.
5. **Currency exchange rates** — spend-based Scope 3 uses approximations in `lib/calculation/units.ts`; use live rates in production.
