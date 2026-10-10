# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement (set by the owner, standing instruction)

- **Replies in caveman style, always** (the `caveman` skill, level full): terse, fragments fine, all technical detail kept. Code, commits, PRs and docs stay in normal prose.
- **Always merge finished work to `main`.** After lint, typecheck, tests and build pass on the working branch, merge it into `main` (fast-forward when possible, otherwise a merge commit) and push `main`. No need to ask first. `migrate.yml` applies migrations when `main` moves, so the migration rules below still apply before merging.
- **Agent tooling:** ponytail (Claude Code plugin `ponytail@ponytail`, marketplace `DietrichGebert/ponytail`), superpowers (`superpowers@superpowers-marketplace`) and graphify are enabled for this repo in `.claude/settings.json`, so cloud sessions of this repo get them with no setup script. `scripts/dev-tools/install-agent-tools.sh` enables both for every project on a machine (user-scope `~/.claude`): run it once locally, or paste it into a cloud environment's setup script. The same script also enables **superpowers** (plugin from `obra/superpowers-marketplace`: brainstorm, plan, TDD and review skills; use it for large features, skip it for one-line fixes) and the **context7** MCP server (current docs for Next.js 16, Prisma, Better Auth, Tailwind 4, Remotion; optional free `CONTEXT7_API_KEY`). **Evaluated and not installed:** claude-mem (its installer defaults to a hosted memory account and cloud sync; this repo's sessions touch customer-adjacent data, so opt in per machine only with `--provider host` and `CLAUDE_MEM_ONLINE_OPTIN=false`), Comp AI and Papermark (AGPL: read for ideas, never copy code; management systems stay clean-room), pdfcn (React PDF components on Takumi/Forme; reports here render HTML through Chromium, so no fit), and the awesome-claude-skills and claude-skills catalogues (hundreds of skills cost context on every session; install single skills when a task needs one). Headroom is not auto-configured: it reroutes all model traffic through a local proxy (`ANTHROPIC_BASE_URL`), so it is an opt-in per machine (`headroom init claude --global`).

## Token budget

Cost is context size, not output: each call re-reads the whole context, and CLAUDE.md is about half of the fixed floor. Keep a working context under 200k tokens (compact at task boundaries, before long idles, never mid-task), do not switch models mid-session, pipe long command output through `tail`/`grep`, and send research and log reading to a subagent. Standards and the measured numbers: `docs/dev/TOKEN_STANDARDS.md`; measure with `pnpm tokens`.

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
- **Object Storage:** Supabase Storage (private bucket `carbonsite`), through the Storage API (`STORAGE_DRIVER=supabase`) or its S3-compatible endpoint (`r2` driver with `STORAGE_ENDPOINT`). A Postgres driver is the zero-infra fallback. Dev: local filesystem adapter.
- **Email:** Resend (3k/month free, 100/day). Dev: log to console.
- **Push Notifications:** Firebase Cloud Messaging (FCM) — free, Google account only.
- **Document Parsing:** `xlsx` (CSV + Excel), `pdf-parse` (PDFs) — all npm, no Python, no Docker. DOCX is not parsed.
- **Emission Factors:** DEFRA 2025/2026 + EPA GHG Hub 2025 + EPA USEEIO 1.3 + ADEME Base Carbone + Defra UK spend multipliers — seeded into PostgreSQL, zero paid API
- **PDF generation:** Puppeteer (headless Chromium) in the reports worker
- **Validation:** Zod at all API boundaries
- **UI:** shadcn/ui + Tailwind CSS 4 + `motion` (animations)
- **Flutter state:** Riverpod; routing: go_router; HTTP: Dio; offline: drift/SQLite; OCR: google_mlkit_text_recognition (on-device, free, offline)

**No Docker. No paid subscriptions.** One deliberate exception: `api/forecast.py`, a stateless Prophet forecasting function deployed as a Vercel Python Function in this same project (no separate host, no Docker) — see `docs/dev/features/platform-services.md` (Forecasting). Everything else is Node/TypeScript.
External accounts required: Supabase (Postgres + Storage) + Resend (email) + Google (FCM). No Cloudflare account is used.
Optional: Redis for production rate limiting (recommended but automatic Postgres fallback provided).

## Commands

```bash
# Development
pnpm dev               # Start Next.js dev server
pnpm build             # Production build
pnpm lint              # ESLint
pnpm knip              # Unused files and dependencies (CI gate; exports not gated yet)
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
pnpm lint && pnpm knip && pnpm typecheck && pnpm test && pnpm build
```

## Feature detail (read on demand)

CLAUDE.md holds only the rules that apply everywhere. The detail for each feature area is in `docs/dev/features/`; open the file before changing code in that area, and update it (not CLAUDE.md) when the feature changes.

| File | Covers | Code |
|---|---|---|
| `calculation.md` | Spend by industry, spend-based Scope 3, no-factor records and gallons, EPA/eGRID, national libraries (AU, CA, DE, IE), country profile, currency and locale, organisation commitments in reports, ESRS E5 fallback, base year units. | `lib/calculation/`, `lib/factors/`, `lib/country/`, `lib/i18n/` |
| `dashboard-and-views.md` | Dashboard slices and filters, flagship charts, customisable dashboard, cross-filtering, short menu, quick find, site map pins, saved views on every page, form kit, interface libraries, address search, Arabic pilot, monthly checklist. | `app/(app)/orgs/[orgId]/dashboard`, `lib/dashboard/`, `lib/saved-views/`, `lib/map/`, `components/forms/` |
| `waste-and-site-ops.md` | Fuel stores, material movements, upload links, KPI report, SWMP and register checks, carrier uploads and bulk approve, Companies House, OCR bundling and the transfer-note corpus, site operations report, Defra DWT plan, scorecard, ask the carrier, monthly pack, evidence seals, plant telematics, add from a bill, evidence tiers, commuting. | `lib/waste/`, `lib/fuel/`, `lib/material/`, `lib/evidence/`, `lib/plant/`, `lib/commuting/`, `lib/geo/` |
| `reporting-and-compliance.md` | Sustainability report, climate disclosure (TCFD), double materiality, case studies and noticeboard, transition plan, internal carbon price, carbon budget burn-down, PAS 2080, Abu Dhabi export, report picker, bid pack, CRP, PPN 026, local spend, planning obligations, go-to-market, regulatory calendar, Find a Tender, accounting lines, embodied carbon, HVO, toolbox talks and fleet. | `lib/reports/`, `lib/crp/`, `lib/social-value/`, `lib/tenders/`, `lib/ledger/`, `lib/climate-disclosure/`, `lib/transition-plan/` |
| `management-and-assurance.md` | Assurance pack, recompute check, verifier links; management systems catalogue, registers, reminders, certification, PQQ, field safety capture. | `lib/assurance/`, `lib/management-systems/`, `lib/pqq/` |
| `platform-services.md` | ERP export profiles, machine ingest, forecasting and model selection, AI assistance, import column mapping, live dashboard stream, OCR confidence. | `lib/imports/`, `lib/connectors/`, `lib/forecasting/`, `lib/llm/`, `lib/jobs/` |
| `marketing-site.md` | Design system and kit, real-claims rule, demo analytics, scroll effects, what pages may say about the calculation, demo labelling, launch film, report types, field app availability. | `app/(marketing)/`, `components/marketing/` |
| `reference-data.md` | Table of every loaded factor library, source, format and migration. | `prisma/data/`, `data/sources/`, `scripts/build-*-factors.*` |
| `decisions.md` | Factor licensing, methodology versioning policy, billing and plans (Stripe), primary report format, spend factors and price years, CPI table. | `lib/billing/`, `lib/calculation/methodology.ts`, `lib/calculation/price-index.ts` |
| `operations.md` | Data upkeep workflow, Knip, security scan, accessibility checks, Actions minutes, CI budget, uptime, backups. | `.github/workflows/`, `scripts/data-watch/`, `scripts/backup/` |

## Rules that apply everywhere

- **Say where to fix it.** Wherever the app says something is missing, say where to add it and link to the page; `lib/completeness/__tests__/fix-paths.test.ts` fails on a link to a page that does not exist.
- **Methodology versions.** Bump (new `methodology_versions` row by migration plus a `METHODOLOGY_CHANGELOG` entry in `lib/calculation/methodology.ts`) only for rule changes that alter a figure from the same records and library: GWPs, Scope 2 allocation, spend conversion or deflation, fuel and unit conversion, headline scope. Not for factor libraries, layout or bug fixes.
- **Factor attribution.** Every report and CSV carries the attribution from the library's `license` field (`lib/reports/attribution.ts`). Never load a source whose licence has not been checked; record it in `docs/THIRD_PARTY_SOURCES.md`.
- **Formatting.** Format dates, numbers, money and tonnes through `formatters()` / `useOrgMoney()` (`lib/i18n/org-format.ts`); never hard-code a country, currency or regulator. A figure kept in a fixed currency says so in its label.
- **OCR routes.** A route that calls `documentText()` must be in `outputFileTracingIncludes` and `Excludes` in `next.config.ts` with `OCR_FILES`; build and check its `.nft.json` lists `tesseract.js-data` and `@napi-rs/canvas`.
- **UI kit.** Forms use `components/forms/form-kit.tsx` (no new local `Field`); empty states use `EmptyState`; wide tables use the shared `Table`; public-register results use `RegisterResultCard`. Route files must not export helpers (put shared schemas in a sibling file).
- **Only real claims.** Marketing and reports state only what the code and data support: no invented testimonials, metrics or competitor comparisons, no "not applicable" the organisation has not chosen, and no claim of regulatory compliance or lawfulness. Do not link or claim the App Store until it is approved.
- **Filters live in the URL.** A page that filters joins `SURFACES` in `lib/saved-views/index.ts`; records page filters are only `periodId`, `categoryId`, `reviewStatus`, `facilityId`, `contractId`, `siteId`, `supplier`.

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
    queues/index.ts        # pg-boss queue definitions (imports, calculations, reports, notifications)
    dispatch.ts            # dispatchX(): runs a job inline on Vercel, or enqueues in worker mode
  storage/index.ts         # Storage drivers (Supabase in production), presignUpload/Download, key conventions
  validation/
    api.ts                 # handleRouteError(), apiError() — consistent { code, message, details? }
  calculation/
    units.ts               # Canonical unit registry + normalizeUnit()
    factor-selector.ts     # selectFactor() — deterministic, records selection reason
    engine.ts              # computeCo2e() — gas-specific or scalar, stores formula string
    scope2-method.ts       # scope2MethodOf(): the one place a record's Scope 2 method is decided
    scope2-instruments.ts  # Market-based allocation of REGOs/PPAs/tariffs/residual mix (pure)
    dashboard-groups.ts    # DashboardAggregate grouping (pure; shared with the reconciliation test)
    aggregate-filters.ts   # Where-fragments for reading DashboardAggregate without double counting
    library-for-period.ts  # chooseFactorLibrary(): newest DEFRA set whose year <= period end year
    default-run-inputs.ts  # Library/methodology for automatic runs: published snapshot's, else chooseFactorLibrary()
    geography.ts           # recordCountry(): record, then facility, then org country as ISO-2 for factor matching
    library-country.ts     # Library home country; a run on another country's library needs confirmLibraryCountry
    price-index.ts         # CPI deflation of spend to a factor's price year
prisma/
  schema.prisma            # Canonical schema — all tenant tables include organization_id
  migrations/
  seed.ts                  # Seeds categories, methodology version, DEFRA/EPA library records
workers/
  index.ts                 # pg-boss worker entry point (only for a worker-mode deployment)
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
All presigned URLs generated server-side after auth checks. Expiry: 1 hour (`PRESIGN_TTL` in `lib/storage/index.ts`, raised from 15 minutes to tolerate slow/interrupted downloads). Never expose raw storage keys to clients.

### API Routes
- Validate all input with Zod before touching the database.
- Return `{ code, message, details? }` for all errors via `handleRouteError()` in `lib/validation/api.ts`.
- Use cursor pagination by default on list endpoints.
- Accept idempotency keys on imports, calculation runs, and report generation. Store business keys (`source_checksum`, `trigger_hash`, `request_hash`) in the database to detect duplicates before enqueuing.

### Security guards (keep these when adding features)
- **Database roles:** Supabase's `anon` and `authenticated` roles have no grants on `public` (migration `20260922000012`). The app never uses the Supabase Data API; Prisma connects as `postgres`, which bypasses RLS. Every new table still gets `ENABLE ROW LEVEL SECURITY` plus a deny-all policy in its migration.
- **Shared reference data** (factor libraries, embodied materials, framework datapoints) is read by every tenant. Org routes must never write it. Imports go through `requireSharedLibraryEditor()` in `lib/auth/shared-libraries.ts` (platform owner/support only). Per-org text about a shared row lives in its own org-scoped table (e.g. `OrganizationDatapointNarrative`). An org's own factors live in `OrganizationEmissionFactor`: the factor import writes there unless a platform editor picks a shared library.
- **Terms at sign-up:** creating an account needs `acceptedTerms: true` and `termsVersion` equal to `TERMS_VERSION` (`lib/legal/terms.ts`); Better Auth's `before` hook in `lib/auth/index.ts` answers 400 `TERMS_NOT_ACCEPTED` otherwise, and the `after` hook stores `terms_accepted_at`/`terms_version` on the user (migration `20261011000092`). Bump `TERMS_VERSION` with the Terms page. Accounts created outside sign-up (invites, SSO, supplier, bulk) have no recorded acceptance, so the `(app)` layout redirects them to `/accept-terms` (`app/accept-terms`, POST `/api/account/terms`) until they accept the current version. The API is not gated, so installed mobile builds keep working. Every account without an accepted version, including accounts created before this change, sees the page once.
- **Passwords set by an admin:** hash with `hashTemporaryPassword()` from `lib/auth/temporary-password.ts` (Better Auth's format; bcrypt/SHA-256 can never sign in). Never set a password on an account that exists outside the org: check `accountBelongsOnlyToOrg()`. Invite acceptance takes the org from the invite, never the request body.
- **Errors:** `handleRouteError()` returns a generic 500 with a Sentry reference, never the raw message.
- **Ids from the request:** any project, site, facility, business unit, period, contract, permit, method statement, activity record, evidence file or `*UserId` a route stores must be checked with `orgRefsError(orgId, {...})` (`lib/security/org-refs.ts`; social value uses `svRefsError()`). Never spread a request body with id fields into a write unchecked.
- **Regression tests:** `tests/security/cross-tenant-writes.test.ts`.

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

**Deployment reality: this project runs on Vercel only, with no separate host running `workers/index.ts` continuously.** Vercel serverless functions cannot run a persistent pg-boss consumer, so a queue with no other consumer is a queue nothing ever drains. `lib/jobs/dispatch.ts` is the load-bearing piece that makes this work anyway: `dispatchImport()`, `dispatchCalculation()`, `dispatchReport()`, `dispatchNotification()`, `dispatchDsarExport()`, `dispatchDsarErasure()`, and `dispatchForecast()` each check `JOB_PROCESSING_MODE` (env var, defaults to `"inline"`) — in `inline` mode (the only mode that actually works on Vercel-only) the job runs synchronously inside the API route's request/response cycle instead of being enqueued; in `worker` mode it enqueues to pg-boss as normal, for a deployment that *does* run a separate worker process. **Always call a route through its `dispatchX()` function, never `enqueueX()`/`boss.send()` directly** — a route that enqueues without going through `dispatch.ts` will silently never run on this deployment. The older queues (`invoice-anomaly`, `xero-sync`, `quickbooks-sync`, `supplier-performance`, `causal-analysis`) now go through `dispatch.ts` too. The exception is `dbt-transform`: it shells out to the Python `dbt` CLI, which Vercel does not have, so `dispatchDbtTransform()` skips it inline and only enqueues on a worker deployment.

**Live dashboard:** `GET /api/orgs/{orgId}/dashboard/stream` is an SSE stream that polls `loadLiveTotals()` (`lib/realtime/live-totals.ts`, live `DashboardAggregate` rows of the latest period) every 15 s for up to 280 s and pushes only when the run or total changes; the client reconnects. There is no in-process pub/sub, since serverless instances do not share memory.

**Import column mapping:** one alias list, `lib/imports/column-mapper.ts`, serves the preview UI and the worker's fallback (`mapColumns()`); canonical field names (`emissionCategoryCode`, `spendAmount`) always map, which the connector CSV relies on. **Machine-to-machine ingest:** `POST /api/orgs/{orgId}/integrations/{utilities|fleet|corporate-cards|webhooks}/ingest` with an org API key. `lib/connectors/ingest.ts` turns connector output into a canonical CSV and runs the normal import pipeline, so the data waits in Imports for a person to commit it. A retried identical payload returns the first batch.

Core queues: `imports`, `calculations`, `reports`, `notifications`, `forecasting`.

**Scheduled jobs run from Supabase pg_cron, not pg-boss schedules** (nothing on Vercel would fire those). Migrations `20260922000010` and later register `cron.schedule` entries that call the app's secret-protected routes through `scheduler.call_app(path)` (pg_net), reading `app_base_url` and `scheduler_secret` from Supabase Vault. Routes check the secret with `isAuthorizedCronRequest()` (`lib/security/cron-auth.ts`, accepts `SCHEDULER_SECRET` or `CRON_SECRET`). Monitoring jobs live in `app/api/admin/schedule/monitors/[job]/route.ts`: submission SLA, permit expiry, enforcement notices, supplier account policies, carbon budget forecasts, Find a Tender watches (daily). To add one, add it to that route and schedule it in a new guarded migration.

All jobs must be idempotent and retryable (3 attempts, exponential backoff). Store job status in DB (`ImportBatch.state`, `CalculationRun.status`, `Report.status`).

Import state machine:
```
uploaded → parsing → validating → needs_attention | ready_to_commit → committed | failed
```

**Document parsing (npm, no Python):**
- `xlsx` — CSV and Excel (.xlsx/.xls) import templates
- `pdf-parse` — PDF utility bills and delivery notes

Called from the `imports` worker, not a separate service.

### Calculation Engine (`lib/calculation/`)
Pipeline for each `CalculationRun`:
1. Select target `ActivityRecord` rows for org + period + status.
2. `normalizeUnit()` — convert to canonical unit, store both original and normalized.
3. `selectFactor()` — matches category, geography, date, scope-2 method; records selection reason.
4. `computeCo2e()` — gas-specific (`CO2 + CH4×GWP + N2O×GWP`) or scalar; stores formula string.
5. Persist immutable `EmissionCalculation` rows — **never update them**.
6. Rebuild `DashboardAggregate` rows for the snapshot.

GWP values (AR6): CH4 = 27.9, N2O = 273 (`lib/calculation/gwp.ts`).

**Organisation factors first:** each record is matched against the org's `OrganizationEmissionFactor` rows (`pickCustomFactor()` in `custom-factors.ts`: same category, usable unit, dates cover the activity, any country/activity it names must match; most specific, then latest version) before the run's shared library. The calculation stores `organizationEmissionFactorId` instead of `emissionFactorId`; a factor a calculation used cannot be deleted, only superseded by a new version.

**Factor library per run:** a run is pinned to one library. `chooseFactorLibrary()` picks the newest DEFRA set whose year is at most the period's end year (DEFRA 2026.1 has no effective-date window, so it covers periods that straddle years); the UI warns when another library is chosen. EPA stays available for US operations.

**Purchased heat (`s2-heat`):** district heating/cooling per kWh delivered. Counted in location-based Scope 2 and, when the run has market-based electricity, in the market-based total too (`inBothScope2Totals()` in `scope2-method.ts`, applied by `groupDashboardAggregates()` and `splitScope2()`), so market-based is never heat alone. Factors: DEFRA 2025.2/2026.1 "Heat and steam" (district default, "onsite" by hint) and ADEME networks. ADEME's named networks are only used when the record names the network in its fuel type field (the record form's Heat network search, `GET /api/orgs/{orgId}/heat-networks`, or "ADEME <id>"); otherwise the national default applies (`pickHeatNetwork()`, `lib/calculation/heat-network.ts`).

**Net calorific value:** `kWh_ncv` (aliases kWh PCI, GJ/MJ PCI, toe/tep) is its own unit dimension, never converted to or from gross `kWh`: the ratio depends on the fuel.

**Scope 2 dual reporting:** `scope2MethodOf()` decides each record's method (the record's `scope2Method`, else the category). Headline totals use location-based only; market-based is shown beside it, never added. Market-based records draw on the org's `EnergyInstrument` rows (Settings → Electricity contracts) in GHG Protocol order: certificates/PPAs, green tariffs, supplier rate, residual mix; certificates are never claimed twice; any uncovered kWh falls back to the library factor with a warning.

**Spend-based Scope 3:** currency is converted at the ECB rate for the record's date (`prefetchFxRatesOn()` / `convertCurrency()` in `units.ts`), falling back to today's rate and then a built-in rate, and the calculation says which. When a factor has `priceBaseYear`, spend is deflated to that year with UK CPI, US CPI-U or the euro area HICP (`price-index.ts`); update the CPI table each year.

**Interface libraries** (`docs/THIRD_PARTY_SOURCES.md` has the licences): ReUI (MIT) stepper and timeline in `components/reui/`; shadcn Empty and Kbd in `components/ui/`; `EmptyState` (`components/ui/empty-state.tsx`) is the one empty state, so do not hand-build a centred icon circle again; `TextShimmer` (adapted from ForgeUI, whose licence bars redistribution as a library) marks AI waiting states. `SectionNav` (`components/structured-forms/ms-fields.tsx`) is a vertical ReUI Stepper where a step is "done" from data, not from position (`positional={false}`). The methodology history on the marketing site is a ReUI Timeline. Before adding another ReUI component: its demo files use `IconPlaceholder` and `@/registry-reui` paths, so copy the resolved file from `public/r/styles/radix-vega/<name>.json` instead; knip fails on unused files, so add a component only with its first use.

Published snapshots are immutable. Recalculation creates a new `CalculationRun` + `PublishedSnapshot` version. Users must see a diff before replacing a published report.

### Migrations
`.github/workflows/migrate.yml` applies migrations as soon as code reaches `main`, **while the previous deploy is still serving traffic**. So:
- Additive changes only in the same release as the code. A drop, rename, type change or `SET NOT NULL` must ship in a later release, in a migration containing a `-- contract-step:` line explaining why no deployed code still depends on it. `scripts/check-migration-safety.mjs` enforces this in CI and before migrating.
- CI replays every migration on plain Postgres 16, where Supabase roles and the `cron`/`vault`/`storage` schemas do not exist: guard Supabase-specific SQL with `IF EXISTS (SELECT 1 FROM pg_roles ...)` / `to_regnamespace(...)` checks inside a `DO $do$` block.
- CI fails if `prisma migrate diff` grows beyond `prisma/drift-baseline.txt`, which is 0 since migration `20260924000031`: every schema change needs its migration. Generate new migration SQL with `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel prisma/schema.prisma --script`, never by hand.

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
Reports generated asynchronously from a `PublishedSnapshot` using Puppeteer. Report totals must match dashboard totals for the same snapshot — this is a core trust invariant, guarded by `lib/calculation/__tests__/report-dashboard-reconciliation.test.ts`. Generated PDFs/CSVs stored in Supabase Storage with checksums. Download links are 1-hour signed URLs.

**Embodied carbon from delivery notes** (`lib/embodied-carbon/delivery-notes.ts`): approving a `delivery_note` field submission also creates an `EmbodiedCarbonRecord` (source `delivery_note`) against the site's project. The material is matched from the note's description (`matchMaterial()`; the reviewer can change it or opt out), a supplier's own valid EPD replaces the library factor, A1-A3 comes from the factor and A4 from the actual delivery (tonnes x route km x the DEFRA HGV tonne.km factor for the date). Aggregates and asphalt use DEFRA's Material use factors (primary, or closed-loop when the note says recycled). Materials with no library factor (topsoil) and unconvertible quantities (bags, m2 of a per-kg product) create no record; the audit log says why. This is the project whole-life view; the Scope 3 inventory keeps its own ActivityRecord.

**HVO and biogenic CO2:** DEFRA biofuel/biomass factors carry their "outside of scopes" biogenic CO2 (`biogenicCo2`, from the flat file via `scripts/build-defra-factors.mjs`), reported beside the inventory, never in it. `hvoShare()` (`lib/calculation/fuels.ts`) reads HVO, HVO100, "renewable diesel" and blends (HVO50, "30% HVO") from a record's `fuelType`; `selectHvoFactor()` uses the library's HVO factor (also for generators, whose category has none) and weights blends with the category's diesel factor. Approved fuel receipts carry `fuelType` onto the record.

**Defra Digital Waste Tracking (planned, not live)** (`docs/DEFRA_WASTE_TRACKING_PLAN.md`, `lib/defra-dwt/receipt.ts`): Defra's Receipt of Waste API is for permitted receiving sites, from 1 October 2026 in England and Wales and 1 January 2027 in Scotland and Northern Ireland. Only the request schema (`receiptSchema`, `receiptProblems()`) and `submissionDeadline()` exist; nothing calls Defra, and nothing may before test credentials arrive and a person confirms each submission. Source repository and spec are OGL v3.0.

**Monthly project pack** (`lib/waste/pack.ts`, `/orgs/{orgId}/waste/pack?projectId=&month=YYYY-MM`, print or save as PDF from the browser): one project and month for a client: key figures (the KPI catalogue), loads recorded, Site Waste Management Plan progress, licences and permits expired or ending within 30 days, and carrier register checks already made with the Environment Agency attribution; blanks say what is missing and nothing is invented. Tests: `tests/security/waste-accept-record.test.ts`, `lib/waste/__tests__` (`reminderStage`, `siteScope`).

**Plant and telematics** (`lib/plant/`, sidebar → Plant): `PlantAsset` register and `PlantTelematicsReading` (hours, idle hours, fuel). Readings arrive as ISO 15143-3 / AEMP 2.0 snapshots (cumulative counters differenced per machine; a reset counter gives no value) at `POST /api/orgs/{orgId}/integrations/plant/ingest` with an org API key, or as CSV period rows on the page; unknown serials are added to the register and flagged. Readings are monitoring only, never inventory: the page shows idling, fuel, carbon, HVO share and saving, and reconciles each site's burnt fuel against its approved diesel/HVO records.

**PAS 2080:2023** (`lib/pas2080/`, project page → PAS 2080): per project a `CarbonManagementPlan` (value chain role, carbon lead, baseline and its basis, target, EN 17472 modules in scope) and a `CarbonReductionOpportunity` log against the 2023 hierarchy (build nothing, build less, build clever, build efficiently). Forecast = baseline less adopted/implemented savings; measured = `measuredProjectTco2e()` in `lib/project-carbon/measured.ts` (embodied records + approved site activity, latest calculation per record, market-based Scope 2 excluded via `HEADLINE_ONLY`). A rejection needs a reason; decided entries cannot be deleted. `pas2080Checks()` lists what is missing.

**Internal carbon price** (`lib/carbon-price/`, Settings → Carbon price): versioned `InternalCarbonPrice` rows per org (shadow price, internal fee or implicit price; scopes; uses; basis). `appraisalPrice()` picks the one in force (shadow first). It values the dashboard's scope totals, nets the pathway/MACC cost per tonne (price and each initiative's `costCurrency` converted to the org's reporting currency by `lib/reductions/macc-inputs.ts`; an unconvertible initiative is named and left off), and answers ESRS E1-8 (`internal_carbon_price` resolver; with no price, a manual crosswalk entry such as "none used" is respected).

**Carbon budget burn-down** (`lib/project-carbon/burndown.ts`, loader `burndown-load.ts`): measured project carbon by month (same scope as `measuredProjectTco2e()`) against a straight spend line between the project's start and end dates. Forecast at completion uses the phases' EVM once `computeCarbonEvm()` reports `cpi_trend`, else the last three months' run rate. Status `over` / `at_risk` (forecast above 90% of budget, or burning 10% ahead of plan). The daily `carbon-budgets` monitor (`burndown-alerts.ts`) notifies editors and project managers with `carbon_budget_forecast` only when the status gets worse; `CarbonBudget.forecastAlertLevel` remembers the last level. `BudgetStatusChip` shows the status on the contract's project list and the project page.

**OCR confidence in review:** the app sends per-field OCR confidence as `formData.__ocrConfidence__`; `POST /field-submissions` moves it to `ocrExtractedData.__confidence` (`sanitiseOcrConfidence()`, `lib/field-submissions/ocr-confidence.ts`). `ocrFieldChecks()` orders the review page's Document verification table weakest first (red: read below `LOW_OCR_CONFIDENCE` 0.6 and not corrected; amber: changed after reading) and the queue shows "Check N fields". App builds before this change send no confidence, so their rows show "-".

**ESRS E5 without a waste register:** when a period has no `WasteRecord` rows, the E5 report uses the tonnes on the run's `s3-waste` activity records (`wasteRowsFromRecords()`, `lib/waste/from-records.ts`; t and kg only). Route and hazard status come only from the record's own text (a route word, an EWC code with or without `*`), never from the factor the calculation chose; unknown ones print "Not recorded" and diversion is a share of tonnes with a known route.

**Regulatory calendar** (`compliance/deadlines/page.tsx`): each entry carries its official `source` and the page shows `LAST_CHECKED`. Recheck dates and thresholds each quarter and move `LAST_CHECKED`. The page shows the regions the org's HQ country and facility countries touch (`lib/compliance/regions.ts`: UK, EU-27, UAE, US, Australia, Canada loaded, plus Germany's national rules beside the EU's; Ireland uses the EU dates, as it transposed the CSRD in July 2024), with a toggle for all; a country with no rules loaded is named, never hidden.

**Report picker:** the report form shows `CORE_REPORT_TYPES` first (GHG Protocol, PPN 006 CRP, SECR, and the bid carbon pack where the plan includes it); every other type is under "Show all report types".

**Base year units:** base years, recalculations and restatements store tCO2e. `computePeriodTotals()` divides DashboardAggregate kg by 1000; migration `20260925000035` converted rows written in kg before that fix.

**Bid carbon pack** (`bid_carbon_pack` report, `lib/bids/carbon-pack.ts`): the carbon section of a tender in one PDF: a PPN 006 Carbon Reduction Plan, emissions trend across published snapshots, up to five featured contracts (emissions, intensity, budget, waste diversion, and National TOMs committed vs delivered by theme and top measures from `summariseSocialValue()`, with a per-contract answer from `contractAnswer()`), assurance status and model answers. Contract social value covers periods ending on or before the snapshot's period end. Every figure comes from published snapshots or org records; nothing is estimated or written by an LLM, and a section with no data is left out. `bidPackReadiness()` runs from the report form's Validate button and blocks a pack with no base year, director sign-off or net zero year by 2050.

### Data quality guards
- **Duplicates** (`lib/data-quality/duplicates.ts`): a record with the same category, amount, unit, date, facility and supplier as an existing one is refused with 409 `POSSIBLE_DUPLICATE` unless sent with `allowDuplicate` (the record form asks); imports flag such rows, and rows repeated within the file, as warnings. Facility names are unique per org (case-insensitive, 409 `FACILITY_EXISTS`).
- **Unpublished changes:** when live aggregates differ from the period's latest snapshot, the dashboard shows the signed difference above the headline with a link to review and publish the latest run.

### Audit Log
`AuditLog` is append-only via `writeAuditLog()` in `lib/db/audit.ts`. Never update or delete rows. Required events: auth, role changes, imports, record mutations, factor imports, calculation runs, snapshot publication, report publication, field submission submission/review. **Hash chain** (`lib/audit/chain.ts`, migration `20261006000078`): one chain per organisation. `writeAuditLog()` takes a per-organisation Postgres advisory lock in a transaction, reads the true last row by `chainSeq`, and stores `createdAt` as the exact instant it hashed, so the chain cannot fork and a stored row recomputes to its own hash. A row is `hashVersion` 2 when its hash is `sha256` of a JSON array (version, previous hash, organisation, actor, action, resource type, resource id, metadata with keys sorted by `canonicalJson()`, ISO timestamp), which the database round trip cannot disturb. Rows before that (`hashVersion` null) were hashed from a JS timestamp and key order that were not stored, so only their links can be checked: `verifyAuditChain()` reports them as `legacy`, never as verified. Never insert into `audit_logs` outside `writeAuditLog()` (the SSO route used to, which also restarted the chain). `ChainVerifier` is the one checker; `verifyAuditChain()` pages through the whole chain and returns `intact`, `broken` (first bad `chainSeq` and why: content, link, missing hash) or `empty`, plus the head hash. In the portal: Audit trail → Check the audit trail (`GET /api/orgs/{orgId}/audit-chain`, admin, directors, managers, reviewers, auditors, 10 an hour). Offline: every assurance pack carries `verify-audit-log.mjs` (source in `lib/audit/verify-script.ts`, zero dependencies, `node verify-audit-log.mjs audit-log.csv <organisationId>`), the README states the organisation id and the check run at export, and `lib/audit/__tests__/verify-script.test.ts` runs the script and the library on the same rows. **Retention:** the monthly `audit-anonymise` monitor (`lib/audit/anonymise.ts`, `AUDIT_RETENTION_YEARS` 6) clears actor, IP, user agent and metadata of rows older than six years and sets `redacted_at`; the stored hash stays, so `ChainVerifier` and the offline script check a redacted row's link only and count it as `redacted`, never `verified`. **Limit:** removing the newest entries leaves a shorter chain that still checks, so a verifier compares the head hash (printed by both) with a copy they hold from earlier; nothing outside the database anchors it yet.

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
- Scope 2: `s2-electricity-lb` (location-based), `s2-electricity-mb` (market-based), `s2-heat` (purchased heat, steam and cooling; counted location-based)
- Scope 3: `s3-purchased-goods`, `s3-capital-goods`, `s3-fuel-energy`, `s3-upstream-transport`, `s3-waste`, `s3-business-travel`, `s3-commuting`, `s3-upstream-leased`, `s3-downstream-transport`, `s3-processing-sold`, `s3-use-sold`, `s3-end-of-life`, `s3-downstream-leased`, `s3-franchises`, `s3-investments`

Use only these codes in code (see `prisma/seed.ts`). A code that is not seeded matches nothing and fails silently.

## Testing

- **Unit tests:** `lib/calculation/` (units, factor selection, engine formula). `mobile/test/capture/` (OCR extractor with static PNG fixtures).
- **API tests:** auth flows, RBAC boundaries (all six roles), org scoping, import pipeline, field submission flow.
- **Integration tests:** import → commit → calculate → dashboard → publish → report.
- **Security regression tests:** cross-tenant access attempts (P0 — must not regress). `field_worker` role must not access org aggregates.

Use deterministic fixture factor libraries. Do not use real customer evidence files in tests.

## Performance Constraints

- Dashboard load < 3s for orgs with up to 100k activity records → use `DashboardAggregate`, never raw aggregation at request time.
- Prisma has one connection per function instance (`connection_limit=1`), so queries in a `Promise.all` still run one after another and each costs a database round trip. Cut the number of queries, not their order: the dashboard reads its counts, the latest run's data quality figures and published libraries with one statement each (`lib/dashboard/page-data.ts`, checked against the Prisma queries they replaced by `tests/golden/dashboard-page-data.test.ts`), and `getSession()`/`requireOrgMember()` are wrapped in React `cache()` so a layout and its page share one lookup.
- The dashboard's site hero (`components/dashboard/site-hero.tsx`, loaded under `Suspense` by `dashboard/site-hero-section.tsx`) shows live pins for the dashboard's period from `loadLiveSites()` (`lib/map/load.ts`). A pin or a row sets `siteId` (project sites; also saves the site's project as the sidebar choice) or `facilityId` (offices and depots) through `lib/map/site-hero.ts`, which replaces any earlier site choice; the Project dropdown lives in the hero now, not the filter bar. A "Compare all sites" table under it (`compareRows()`, sortable) shows tonnes, share within the site's own kind (offices and project sites overlap, never added) and records. Coinciding pins are spread for display only; only the three biggest pins carry a name. The Site map keeps the published, scrubbable view.
- The dashboard logs a `page-timing` line (info; a warning, which also reaches Sentry, only at 3x the threshold) (`stageTimer()`, `lib/dashboard/stage-timer.ts`: organisation, groups and totals, panels, layout, in milliseconds, organisation id only) when a load takes 1.5 s or more (`PAGE_TIMING_SLOW_MS` changes the threshold without a code change). Read those lines from the Vercel logs before splitting the page: `loading.tsx` already shows a skeleton while the page works, so wrapping the same body in `Suspense` gains nothing, and a real streaming split needs the slow panel's data separated first.
- Shared reference data is cached: `getEmissionCategories()` (one hour) and `getFactorLibraries()` (five minutes) in `lib/cache/reference.ts` (`unstable_cache`, keyed by deploy, tags in `REF_TAGS`; the platform library route calls `revalidateTag`). Only data identical for every organisation goes there, never a per-organisation read, because the key carries no organisation id. Outside the Next runtime (tests, workers) the helpers read the database directly.
- Wide tables stack into labelled cards below 640px through the shared `Table` (`components/ui/table.tsx`, `table[data-stack]` in `globals.css`). Use it, not a raw `<table>` with a `min-w-[...]`, for any table people read on site; it needs plain `thead`/`tbody` with `td` cells (no `th` in the body, no `rowSpan`). Converted so far: fuel, material movements, plant, waste plan, monthly pack, carrier scorecard and 19 more (settings, contracts, lineage, management systems, commuting, match bills). Left raw on purpose: matrix and comparison tables (completeness, integrated view, training matrix, KPIs), tables with a body `th`, tables with no `thead`/`tbody`, and tables not already inside a scroll wrapper (waste, waste documents, submission detail and a dozen more), because the shared `Table` adds its own wrapper and could clip menus there; convert those one at a time after looking at the page.
- Heavy client code loads on demand: charts, the site map (MapLibre) and the report narrative editor (Tiptap) are wrapped in `next/dynamic` with `ssr: false` (`components/analytics/lazy.tsx`, `components/charts/lazy.tsx`, `components/map/site-map-lazy.tsx`, `reports/narrative/narrative-editor-lazy.tsx`). `optimizePackageImports` covers lucide-react, recharts and date-fns. A new chart or editor used below the fold goes behind the same pattern.
- CSV imports up to 25k rows must process asynchronously.
- Stream large exports; never load an entire org dataset into memory.
- Required indexes on `ActivityRecord`: `(organization_id, reporting_period_id, category_id, facility_id, review_status, created_at)`.

## External Services (Free Accounts, No Docker)

All services are free tier, no credit card required.

### Supabase (production database)
- PostgreSQL database hosted on Supabase (supabase.com)
- Connection: Set `DATABASE_URL` in `.env` with Supabase connection string
- For local dev, install Postgres natively or use Supabase CLI for local development
- Supabase provides: Postgres, real-time subscriptions, auth (optional), vector/pgvector support
- For production migrations: `pnpm prisma migrate deploy`

### Supabase Storage (object storage)
- Private bucket `carbonsite` (`STORAGE_BUCKET`), reached server-side with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; downloads are signed URLs, email logos go through `/api/public/orgs/{orgId}/branding/logo`
- Private bucket `backups` holds the encrypted nightly database dumps
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

### Sentry (error tracking, EU region)
- Server: `SENTRY_DSN` (Vercel env), initialised in `instrumentation.ts`; uncaught request errors via `onRequestError`, route errors via `handleRouteError()`.
- Browser: `instrumentation-client.ts`, using the same DSN exposed at build time by `next.config.ts`. The `withSentryConfig` wrapper is not used (it pushes the middleware bundle past Vercel's 1 MB limit).
- Source maps: set `SENTRY_AUTH_TOKEN` on Vercel and `scripts/upload-sourcemaps.mjs` uploads them after `next build`, then deletes them from the public output.

### Redis (optional but recommended for production rate limiting)
- Sign up at upstash.com, aws.amazon.com (ElastiCache), heroku.com, or redis.com — free or low-cost managed options
- Used by: Rate limiting for API endpoints (`lib/security/rate-limit-async.ts`) with automatic Postgres fallback
- Rate limit buckets persist across serverless cold starts (essential for Vercel/Cloudflare Workers deployments)
- Connection: Set `REDIS_URL` in `.env` — format: `redis://` (or `rediss://` for TLS), host and port, with the password your provider gives inside the URL
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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships. It is not committed: `.claude/hooks/graphify-init.sh` (SessionStart) installs or upgrades the CLI in cloud sessions, installs graphify's git hooks (rebuild after every commit and checkout) and rebuilds the graph in the background, so it can lag a fresh session by about a minute.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- The git hooks rebuild the graph after each commit; run `graphify update .` yourself only to query uncommitted changes (AST-only, no API cost).
