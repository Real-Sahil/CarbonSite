# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CarbonSite is a multi-tenant GHG emissions tracking web application for small-to-mid-market companies. It centralizes activity data collection, carbon factor calculations, target tracking, reduction planning, and audit-ready reporting.

**Stack (committed):**
- **Frontend/Backend:** Next.js (App Router) + React + TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Queue/Workers:** BullMQ + Redis
- **Object Storage:** S3-compatible (evidence files, import sources, generated reports)
- **Auth:** Auth.js (NextAuth) with Postgres session adapter, or Clerk if enterprise features are needed early
- **Email:** Transactional provider (SendGrid/Postmark)
- **Validation:** Zod at all API boundaries

## Commands

```bash
# Development
pnpm dev               # Start Next.js dev server
pnpm build             # Production build
pnpm lint              # ESLint
pnpm typecheck         # tsc --noEmit
pnpm test              # Run test suite
pnpm test -- --testPathPattern=<path>  # Run a single test file

# Database
pnpm prisma migrate dev          # Apply migrations in development
pnpm prisma migrate deploy       # Apply migrations in production
pnpm prisma generate             # Regenerate Prisma client after schema changes
pnpm prisma db seed              # Seed emission categories + methodology versions + sample factors

# Workers
pnpm worker            # Start BullMQ worker process (separate from Next.js)

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
  (auth)/                  # Sign in, sign up, reset password pages
  (app)/                   # Authenticated app shell
    orgs/[orgId]/
      dashboard/
      imports/
      records/
      calculations/
      reports/
      targets/
      settings/
lib/
  auth/                    # Auth.js config, session helpers, role checks
  db/                      # Prisma client singleton, typed query helpers
  jobs/                    # BullMQ queue definitions and job processors
    queues/                # imports, calculations, reports, notifications
  storage/                 # S3 client, signed URL generation, key conventions
  validation/              # Zod schemas shared across API routes
  calculation/             # Calculation engine: unit registry, factor selection, formula runner
prisma/
  schema.prisma
  migrations/
  seed.ts
workers/
  index.ts                 # Worker entry point (separate process)
```

## Architecture Patterns

### Multi-tenancy
Every tenant-owned table includes `organization_id`. Every query must include an explicit org scope. There is no opt-out — enforce at the data access layer, not the caller. Cross-tenant access is a P0 security bug.

Object storage keys follow the convention:
```
org/{orgId}/evidence/{evidenceId}/{filename}
org/{orgId}/imports/{importId}/source.csv
org/{orgId}/imports/{importId}/errors.csv
org/{orgId}/reports/{reportId}/report.pdf
```
All presigned URLs are generated server-side after authorization checks. Never expose raw S3 keys to the client.

### API Routes
- Validate all input with Zod before touching the database.
- Return `{ code, message, details? }` for all errors.
- Use cursor pagination by default on list endpoints.
- Accept idempotency keys on imports, calculation runs, and report generation requests. Store business keys (`source_checksum`, `trigger_hash`, `request_hash`) in the database to detect duplicates before enqueuing.

### Authorization (RBAC)
Roles: `admin | editor | reviewer | viewer | auditor`.

Enforce server-side on every org-scoped request. Check membership + role before any read or write. Auditor access is read-only on a restricted set of endpoints. Never derive authorization from client-supplied headers or body fields.

### Background Jobs (BullMQ)
Four queues: `imports`, `calculations`, `reports`, `notifications`.

All jobs must be idempotent and retryable. Store job status in the database (e.g., `ImportBatch.state`, `CalculationRun.status`, `Report.status`). The web process only enqueues — it never performs long-running work inline.

Import state machine:
```
uploaded → parsing → validating → needs_attention | ready_to_commit → committed | failed
```

### Calculation Engine
Located in `lib/calculation/`. The pipeline for each `CalculationRun`:
1. Select target `ActivityRecord` rows for the org + period + status.
2. Normalize units (store both original and normalized).
3. Select `EmissionFactor` using category, activity type, geography, date, unit compatibility, and Scope 2 method. Record the selection reason.
4. Compute gas-specific or scalar CO2e: `CO2e = normalized_amount × factor_value` (or sum gas components with GWP weights).
5. Persist immutable `EmissionCalculation` rows — never update them.
6. Rebuild `DashboardAggregate` rows for the run's snapshot.

Published snapshots are immutable. Recalculation creates a new `CalculationRun` and a new `PublishedSnapshot` version. Users must see a diff before replacing a published report.

### Reporting
Reports are generated asynchronously from a `PublishedSnapshot`. Report totals must always match dashboard totals for the same snapshot — this is a core trust invariant. Generated PDFs and CSVs are stored in S3 with checksums. Download links are short-lived signed URLs.

### Audit Log
`AuditLog` is append-only. Never update or delete rows. Capture: actor, action, resource type, resource ID, timestamp, and safe before/after metadata. Required events: auth, role changes, imports, record mutations, factor imports/overrides, calculation runs, report publication.

## Domain Model (Key Tables)

See `prisma/schema.prisma` for canonical definitions. The critical relationships:

- `Organization` → owns everything tenant-scoped.
- `ActivityRecord` → committed activity data. References `ReportingPeriod`, `EmissionCategory`, optional `Facility`, `BusinessUnit`, `ImportBatch`.
- `EmissionCalculation` → immutable output per record per run. Denormalizes `factor_library_version` and `methodology_version_name` for audit robustness across future refactors.
- `PublishedSnapshot` → links a `ReportingPeriod` to a `CalculationRun`. Dashboards and reports read from this.
- `DashboardAggregate` → pre-computed totals rebuilt after each calculation run. Never query raw `EmissionCalculation` rows for dashboards.
- `ImportBatch` + `StagedActivityRecord` → staging area. Staged rows are separate from committed `ActivityRecord` rows; no partial commits.
- `AuditLog` → append-only; no `updated_at`.

## Emissions Categories (MVP Scope)

Seeded at startup — do not allow per-org custom categories in MVP:

- Scope 1: stationary combustion, mobile combustion, fugitive refrigerants
- Scope 2: purchased electricity (location-based + market-based)
- Scope 3: business travel, employee commuting, purchased goods & services (spend-based), upstream transportation & distribution (distance/spend-based)

## Testing

- **Unit tests:** calculation formulas, unit conversions, factor selection logic, Zod validators.
- **API tests:** auth flows, RBAC boundaries, org scoping, import pipeline, report generation.
- **Integration tests:** import → commit → calculate → dashboard → publish → report.
- **Security regression tests:** cross-tenant access attempts (P0 — must not regress).

Use deterministic fixture factor libraries and sample import files. Include invalid import files that cover common validation failures. Do not use real customer evidence files in tests.

## Performance Constraints

- Dashboard load < 3s for orgs with up to 100k activity records → use `DashboardAggregate`, never raw aggregation at request time.
- CSV imports up to 25k rows must process asynchronously (never inline in a request handler).
- Stream large exports; never load an entire org dataset into memory.
- Required indexes: `(organization_id, reporting_period_id, category_id, facility_id, status, created_at)` on `ActivityRecord` and related tables.

## Open Decisions (Resolve Before Production)

1. **Emission factor dataset licensing** — which sources are approved for production use and redistribution.
2. **Methodology versioning policy** — how/when `MethodologyVersion` records change and how this is communicated to customers.
3. **Billing** — whether billing is required at first production launch (affects org model, gating, trial flows).
4. **Primary report format** — auditor package vs. customer disclosure vs. internal executive summary (affects report templates).
5. **PDF generation** — React-based renderer vs. HTML-to-PDF (headless Chromium). Architecture doc recommends headless Chromium for MVP.
6. **Auth provider** — Auth.js with Postgres adapter vs. managed provider (Clerk/Auth0).
