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
- **Object Storage:** Supabase Storage (private bucket `carbonsite`), through the Storage API (`STORAGE_DRIVER=supabase`) or its S3-compatible endpoint (`r2` driver with `STORAGE_ENDPOINT`). A Postgres driver is the zero-infra fallback. Dev: local filesystem adapter.
- **Email:** Resend (3k/month free, 100/day). Dev: log to console.
- **Push Notifications:** Firebase Cloud Messaging (FCM) — free, Google account only.
- **Document Parsing:** `xlsx` (CSV + Excel), `pdf-parse` (PDFs), `mammoth` (DOCX) — all npm, no Python, no Docker.
- **Emission Factors:** DEFRA 2025/2026 + EPA GHG Hub 2025 + EPA USEEIO 1.3 + ADEME Base Carbone + Defra UK spend multipliers — seeded into PostgreSQL, zero paid API
- **PDF generation:** Puppeteer (headless Chromium) in the reports worker
- **Validation:** Zod at all API boundaries
- **UI:** shadcn/ui + Tailwind CSS 4 + `motion` (animations)
- **Flutter state:** Riverpod; routing: go_router; HTTP: Dio; offline: drift/SQLite; OCR: google_mlkit_text_recognition (on-device, free, offline)

**No Docker. No paid subscriptions.** One deliberate exception: `api/forecast.py`, a stateless Prophet forecasting function deployed as a Vercel Python Function in this same project (no separate host, no Docker) — see "Forecasting" under Background Jobs below. Everything else is Node/TypeScript.
External accounts required: Supabase (Postgres + Storage) + Resend (email) + Google (FCM). No Cloudflare account is used.
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

**Machine-to-machine ingest:** `POST /api/orgs/{orgId}/integrations/{utilities|fleet|corporate-cards|webhooks}/ingest` with an org API key. `lib/connectors/ingest.ts` turns connector output into a canonical CSV and runs the normal import pipeline, so the data waits in Imports for a person to commit it. A retried identical payload returns the first batch.

Core queues: `imports`, `calculations`, `reports`, `notifications`, `forecasting`.

**Scheduled jobs run from Supabase pg_cron, not pg-boss schedules** (nothing on Vercel would fire those). Migrations `20260922000010` and later register `cron.schedule` entries that call the app's secret-protected routes through `scheduler.call_app(path)` (pg_net), reading `app_base_url` and `scheduler_secret` from Supabase Vault. Routes check the secret with `isAuthorizedCronRequest()` (`lib/security/cron-auth.ts`, accepts `SCHEDULER_SECRET` or `CRON_SECRET`). Monitoring jobs live in `app/api/admin/schedule/monitors/[job]/route.ts`: worker sessions (5 min), submission SLA, permit expiry, enforcement notices, supplier account policies, carbon budget forecasts (daily). To add one, add it to that route and schedule it in a new guarded migration.

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

GWP values (AR6): CH4 = 27.9, N2O = 273 (`lib/calculation/gwp.ts`).

**Organisation factors first:** each record is matched against the org's `OrganizationEmissionFactor` rows (`pickCustomFactor()` in `custom-factors.ts`: same category, usable unit, dates cover the activity, any country/activity it names must match; most specific, then latest version) before the run's shared library. The calculation stores `organizationEmissionFactorId` instead of `emissionFactorId`; a factor a calculation used cannot be deleted, only superseded by a new version.

**Factor library per run:** a run is pinned to one library. `chooseFactorLibrary()` picks the newest DEFRA set whose year is at most the period's end year (DEFRA 2026.1 has no effective-date window, so it covers periods that straddle years); the UI warns when another library is chosen. EPA stays available for US operations.

**Purchased heat (`s2-heat`):** district heating/cooling per kWh delivered. Counted in location-based Scope 2 and, when the run has market-based electricity, in the market-based total too (`inBothScope2Totals()` in `scope2-method.ts`, applied by `groupDashboardAggregates()` and `splitScope2()`), so market-based is never heat alone. Factors: DEFRA 2025.2/2026.1 "Heat and steam" (district default, "onsite" by hint) and ADEME networks. ADEME's named networks are only used when the record names the network in its fuel type field (the record form's Heat network search, `GET /api/orgs/{orgId}/heat-networks`, or "ADEME <id>"); otherwise the national default applies (`pickHeatNetwork()`, `lib/calculation/heat-network.ts`).

**Net calorific value:** `kWh_ncv` (aliases kWh PCI, GJ/MJ PCI, toe/tep) is its own unit dimension, never converted to or from gross `kWh`: the ratio depends on the fuel.

**Scope 2 dual reporting:** `scope2MethodOf()` decides each record's method (the record's `scope2Method`, else the category). Headline totals use location-based only; market-based is shown beside it, never added. Market-based records draw on the org's `EnergyInstrument` rows (Settings → Electricity contracts) in GHG Protocol order: certificates/PPAs, green tariffs, supplier rate, residual mix; certificates are never claimed twice; any uncovered kWh falls back to the library factor with a warning.

**Spend by industry:** a library whose factors carry `activityType` `naics_<code>` (EPA USEEIO 1.3), `naf_<division>` (ADEME spend ratios; a NAF code such as 41.20Z or 79110 matches on its 2-digit division) or `uksic_<group>` (Defra UK spend multipliers; a UK SIC 2007 code matches the group with the longest covering prefix, `groupPrefixes()` in `lib/factors/uk-spend.ts`) prices a record only through the record's own `industryCode`; without one those factors are excluded and the calculation says to add the code. When the run's library has no industry factor for a spend record that names a code, `selectSpendSupplement()` (`lib/calculation/spend-supplement.ts`) prices it from the spend library for the record's currency (GBP Defra UK multipliers, USD EPA USEEIO, EUR ADEME), naming that library in the selection reason; reports credit every library a run used (`runFactorAttribution()`, `lib/reports/attribution-load.ts`). A factor whose notes say "Unverified:" still calculates, with a warning on the calculation.

**Spend-based Scope 3:** currency is converted at the ECB rate for the record's date (`prefetchFxRatesOn()` / `convertCurrency()` in `units.ts`), falling back to today's rate and then a built-in rate, and the calculation says which. When a factor has `priceBaseYear`, spend is deflated to that year with UK CPI, US CPI-U or the euro area HICP (`price-index.ts`); update the CPI table each year.

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

**Plant and telematics** (`lib/plant/`, sidebar → Plant): `PlantAsset` register and `PlantTelematicsReading` (hours, idle hours, fuel). Readings arrive as ISO 15143-3 / AEMP 2.0 snapshots (cumulative counters differenced per machine; a reset counter gives no value) at `POST /api/orgs/{orgId}/integrations/plant/ingest` with an org API key, or as CSV period rows on the page; unknown serials are added to the register and flagged. Readings are monitoring only, never inventory: the page shows idling, fuel, carbon, HVO share and saving, and reconciles each site's burnt fuel against its approved diesel/HVO records.

**PAS 2080:2023** (`lib/pas2080/`, project page → PAS 2080): per project a `CarbonManagementPlan` (value chain role, carbon lead, baseline and its basis, target, EN 17472 modules in scope) and a `CarbonReductionOpportunity` log against the 2023 hierarchy (build nothing, build less, build clever, build efficiently). Forecast = baseline less adopted/implemented savings; measured = `measuredProjectTco2e()` in `lib/project-carbon/measured.ts` (embodied records + approved site activity, latest calculation per record, market-based Scope 2 excluded via `HEADLINE_ONLY`). A rejection needs a reason; decided entries cannot be deleted. `pas2080Checks()` lists what is missing.

**Transition plan** (`lib/transition-plan/`, Carbon Forecast → Transition plan): one living `TransitionPlan` per org holding the ESRS E1-1 / UK TPT narrative (ambition, strategy, locked-in emissions, engagement, governance, capex/opex, Taxonomy capex) and the board approval (admins only; any later edit returns it to draft). The pathway draws the base (SBTi baseline, else the active base year), the 1.5°C benchmark (4.2% of base a year, floored at a 90% cut), the org's target, and a planned line from scheduled initiatives only (no start date, not on the line). `transitionChecklist()` drives the page, the ESRS E1 page and the `transition_plan_disclosed` resolver, which no longer counts initiatives alone as a plan. The `transition_plan` report (`lib/reports/templates/transition-plan.ts`) renders the same view as a PDF; its idempotency hash includes the plan's and initiatives' `updatedAt`, so an edited plan never returns a stale PDF.

**Internal carbon price** (`lib/carbon-price/`, Settings → Carbon price): versioned `InternalCarbonPrice` rows per org (shadow price, internal fee or implicit price; scopes; uses; basis). `appraisalPrice()` picks the one in force (shadow first). It values the dashboard's scope totals, nets the pathway/MACC cost per tonne (price and each initiative's `costCurrency` converted to the org's reporting currency by `lib/reductions/macc-inputs.ts`; an unconvertible initiative is named and left off), and answers ESRS E1-8 (`internal_carbon_price` resolver; with no price, a manual crosswalk entry such as "none used" is respected).

**Carbon budget burn-down** (`lib/project-carbon/burndown.ts`, loader `burndown-load.ts`): measured project carbon by month (same scope as `measuredProjectTco2e()`) against a straight spend line between the project's start and end dates. Forecast at completion uses the phases' EVM once `computeCarbonEvm()` reports `cpi_trend`, else the last three months' run rate. Status `over` / `at_risk` (forecast above 90% of budget, or burning 10% ahead of plan). The daily `carbon-budgets` monitor (`burndown-alerts.ts`) notifies editors and project managers with `carbon_budget_forecast` only when the status gets worse; `CarbonBudget.forecastAlertLevel` remembers the last level. `BudgetStatusChip` shows the status on the contract's project list and the project page.

**Guided Carbon Reduction Plan** (`lib/crp/`, sidebar → Impact reports → Carbon Reduction Plan): one `CarbonReductionPlan` per org and reporting period (migration `20260925000034`) holding the PPN 006 template's own text in `sections` (boundary and exclusions, publication URL, baseline rationale, Scope 3 category explanations, net zero year and interim targets, completed and planned measures, optional SECR intensity and efficiency measures, director sign-off). Figures are never stored on it: `loadCrpContext()` reads the period's published snapshot, records and the active base year, and the page can calculate, publish and set the base year through the normal APIs. `crpReadiness()` lists what an evaluator checks; required items block generation. The `ppn_006_crp` report reads the plan when given `options.crpPlanId` (scoped to org and the report's period; `planVersion` in the options keeps an edited plan from returning a stale PDF). A new plan copies the latest plan's text. Form sections use `components/structured-forms/ms-fields.tsx`, the primitives shared with the method statement editor.

**Go-to-market plumbing:** (1) Opt-in verification line: a CRP's `organisation.showVerificationLine` (wizard checkbox under Declaration) makes the `ppn_006_crp` handler return `verificationLine`, and the worker stamps "Figures calculated from records in MetricOra. Verify this report:" with a link to the report's public verification page on the last page (`addVerificationLine()` in `lib/reports/pdf-generator.ts`); the verify page links to the site with `?ref=verify`. (2) Acquisition: `components/marketing/acquisition-carry.tsx` carries `?ref`/`utm_*` (else the external referrer host) onto internal links by rewriting the next URL only; nothing is stored in the browser (the cookie policy promises no tracking cookies). The sign-up form sends it as `acquisition` and `POST /api/orgs` stores `Organization.acquisitionSource/Medium/Campaign` (migration `20260925000036`; creation only, a malformed value is dropped). (3) `/platform/growth` (`lib/platform/growth.ts`): trials, trials with a ready `ppn_006_crp` or `secr` report, and paying orgs (Starter/Growth/Enterprise, pilots excluded) by week and by source. (4) "Start your Carbon Reduction Plan" links to `/sign-up?start=crp`, which lands the new org on the CRP page; onboarding shows the same shortcut.

**PPN 026 Social Value Model** (`lib/social-value/ppn026.ts`, contract page → PPN 026 Social Value Model): the central government model published 5 August 2026 for procurements from 1 January 2027 of £1m or more (Good Jobs: jobs, conditions, pay; Skills: training, progression, pipeline; minimum weighting 10%, 20% at £5m+). `POST /api/orgs/{orgId}/sv/frameworks/ppn-026` installs it into the org's own `SvFramework` engine (idempotent, slug `ppn-026`, version "August 2026"; when the autumn 2026 sub-criteria land, add a new version rather than editing). Contract KPIs are `SvCommitment` rows with `outcomeId` (migration `20260925000037`) pointing at a criterion; delivery is `SvActivity` entries (approved only, in the KPI's unit, dated up to the period end in the bid pack). `ppn026Checks()`: at least 3 KPIs on £5m+ contracts, targets with units, evidence on every approved entry. The bid carbon pack prints each featured contract's PPN 026 KPIs. Every id a commitment or activity names (contract, framework, criterion, period, owner, commitment, measure, facility) is checked against the org by `svRefsError()` (`lib/social-value/refs.ts`) on create and update.

**Evidence tier and trace a figure:** `evidenceTier()` (`lib/data-quality/evidence-tier.ts`) labels each record Verified (primary data origin, evidence complete, approved), Partially verified (one missing, or reviewed secondary data with evidence) or Estimated; `summariseTiers()` weights by kg CO2e. Shown on the records table (`EvidenceTierBadge`), in the GHG Protocol report ("Evidence behind these figures"), as `data_origin`/`evidence_status`/`review_status`/`evidence_tier` columns in every CSV trail, and on `/orgs/{orgId}/lineage` ("Trace a figure": the published snapshot's headline split by tier, category totals from `CATEGORY_BREAKDOWN_DIMENSIONS`, then a category's calculations largest first with record, factor, formula, selection reason, warnings and evidence downloads; `GET /api/orgs/{orgId}/lineage`, paginated). Approved field submissions create records with `dataOrigin: invoiced` (migration `20260925000038` fixed older ones left at `estimated`).

**Report picker:** the report form shows `CORE_REPORT_TYPES` first (GHG Protocol, PPN 006 CRP, SECR, and the bid carbon pack where the plan includes it); every other type is under "Show all report types".

**Base year units:** base years, recalculations and restatements store tCO2e. `computePeriodTotals()` divides DashboardAggregate kg by 1000; migration `20260925000035` converted rows written in kg before that fix.

**Bid carbon pack** (`bid_carbon_pack` report, `lib/bids/carbon-pack.ts`): the carbon section of a tender in one PDF: a PPN 006 Carbon Reduction Plan, emissions trend across published snapshots, up to five featured contracts (emissions, intensity, budget, waste diversion, and National TOMs committed vs delivered by theme and top measures from `summariseSocialValue()`, with a per-contract answer from `contractAnswer()`), assurance status and model answers. Contract social value covers periods ending on or before the snapshot's period end. Every figure comes from published snapshots or org records; nothing is estimated or written by an LLM, and a section with no data is left out. `bidPackReadiness()` runs from the report form's Validate button and blocks a pack with no base year, director sign-off or net zero year by 2050.

### Marketing site (`app/(marketing)`)
- **One system:** build pages from `components/marketing/kit.tsx` (Section tones dark/paper/light, H1/H2/Lead, `ButtonLink` primary then secondary, then `TextLink`, `ProductShot`/`ProductLoop`, `ClosingCta`). Tokens are the `--color-mk-*` block at the top of `app/globals.css`: graphite ink, cool off-white, one ember accent (`mk-accent` fills with white text, `mk-accent-lit` for text on dark). Geist only. Long-form text uses `.mk-prose`; legal pages use `LegalShell`. Nav groups live in `NAV` in `site-nav.tsx`; the sitemap lists pages by hand in `app/sitemap.ts`.
- **Only real product and real claims:** screenshots and background loops in `public/marketing/{screens,loops}` are captured from the local demo tenant (Northgate Civils Ltd, fictional, labelled "demo data") with `scripts/marketing/record-loops.mjs`; activity comes from `scripts/marketing/demo-activity-csv.py` through the normal import and calculation pipeline. No invented testimonials, customer metrics, competitor comparisons or statistics. Every factor value, feature and plan limit quoted must match the code (plan copy follows `PLAN_FEATURES`/`PLAN_LIMITS`).
- **Report types:** every type with a handler in `lib/reports/registry.ts` (`hasTypedTemplate()`) renders its own HTML layout through headless Chromium; if Chromium fails, `lib/reports/worker.ts` falls back to the generic PDFKit report from the handler's `pdfkitData` and logs a warning. `inventory` has no template and is always PDFKit. Template figures come from the run (library, methodology, GWP) and org records (base year, SBTi target); SECR energy is computed from the run's records by `secrEnergyFromCalculations()` (`lib/reports/secr-energy.ts`, litres at DESNZ 2025 gross CV) unless the form supplies it.
- **Field app availability:** Android is live on Google Play (`app.metricora.metricora_mobile`); iOS (`app.metricora.metricoraMobile`) is in App Store review. Do not link or claim the App Store until it is approved.
- Removed pages (comparison, case studies, `/calculation`, the old blog posts) redirect in `next.config.ts`.

### Data quality guards
- **Duplicates** (`lib/data-quality/duplicates.ts`): a record with the same category, amount, unit, date, facility and supplier as an existing one is refused with 409 `POSSIBLE_DUPLICATE` unless sent with `allowDuplicate` (the record form asks); imports flag such rows, and rows repeated within the file, as warnings. Facility names are unique per org (case-insensitive, 409 `FACILITY_EXISTS`).
- **Unpublished changes:** when live aggregates differ from the period's latest snapshot, the dashboard shows the signed difference above the headline with a link to review and publish the latest run.

### Backups
`.github/workflows/backup.yml`: nightly `scripts/backup/dump.sh` (public schema, pg_dump custom format, AES-256 with `BACKUP_PASSPHRASE`, plus a row-count manifest) to the private Supabase Storage bucket `backups` (migration `20260924000033`, service role key only, `scripts/backup/storage.sh`) under `db/daily/` (pruned after 35 days by the workflow) and `db/monthly/` on the 1st; weekly `scripts/backup/restore-drill.sh` restores the latest into a throwaway PostgreSQL 17 (stub `auth` schema and Supabase roles) and fails if a table is missing or short of the manifest. Secrets are listed in the workflow header.

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
- Scope 2: `s2-electricity-lb` (location-based), `s2-electricity-mb` (market-based), `s2-heat` (purchased heat, steam and cooling; counted location-based)
- Scope 3: `s3-purchased-goods`, `s3-capital-goods`, `s3-fuel-energy`, `s3-upstream-transport`, `s3-waste`, `s3-business-travel`, `s3-commuting`, `s3-upstream-leased`, `s3-downstream-transport`, `s3-processing-sold`, `s3-use-sold`, `s3-end-of-life`, `s3-downstream-leased`, `s3-franchises`, `s3-investments`

Use only these codes in code (see `prisma/seed.ts`). A code that is not seeded matches nothing and fails silently.

## Emission Factor Sources (Zero Cost)

| Library | Source | Format |
|---|---|---|
| DEFRA 2026.1 | gov.uk conversion factors (flat file v1.2) | XLSX → `node scripts/build-defra-factors.mjs <file> 2026` → `prisma/data/defra-2026-factors.json` + migration. Heat and steam (s2-heat) added to 2025.2 and 2026.1 by migration `20260924000030` |
| DEFRA 2025.2 | gov.uk conversion factors (flat file v1) | XLSX → `node scripts/build-defra-factors.mjs <file> 2025` → `prisma/data/defra-2025-factors.json` + migration |
| DEFRA 2025.1 | hand-entered, superseded by 2025.2 | Kept only so runs that used it reproduce; hidden from the library picker (`currentFactorLibraries()`) |
| EPA 2025.1 | epa.gov GHG Emission Factors Hub | PDF → manual CSV (its 3-digit spend factors are flagged Unverified) |
| EPA USEEIO 1.3 | EPA Supply Chain GHG Emission Factors v1.3 by NAICS-6 (1016 factors, kg CO2e per 2022 USD, purchaser price, AR5) | `data/sources/*.csv` → `pnpm tsx scripts/build-useeio-factors.ts <csv> <migration>` → migration `20260923000023`; `priceBaseYear` 2022; records name the supplier's code in `ActivityRecord.industryCode` (import column `industry_code`/`naics`, record form field with lookup); `lib/calculation/industry-code.ts` selects only the exact NAICS factor and never falls back to an arbitrary one |
| ADEME Base Carbone 2025.04 | ADEME Base Empreinte export (`base-carbone.csv`, 5281 factors loaded, Licence Ouverte v2.0) | `data/sources/ademe-base-carbone.csv` → `pnpm tsx scripts/build-ademe-factors.ts <csv> <migration> [--after <earlier migration dir>]` (`lib/factors/ademe.ts`) → migrations `20260923000025` (4111), `20260924000026` (1143) and `20260924000029` (27 more: transport priced for other countries). Only "Valide générique" factors: France electricity by year plus 124 other countries and overseas territories by ISO code (s2 location-based), fuels for mainland France, overseas territories and Europe (s1, litre fuels also mobile, biogenic CO2 kept apart; net-CV rows as `kWh_ncv`), heat and cooling networks (`s2-heat`), waste, passenger and freight transport (vehicle manufacture excluded), AR6 refrigerants, goods per kg/unit, and 2023 EUR spend ratios per NAF division (`naf_<2 digits>`, price year 2023, deflated with France HICP). Not loaded: land use change (per hectare, GHG Protocol Land Sector standard) and electricity split by end use |
| Defra UK spend multipliers 2023 | Defra / University of Leeds, UK carbon footprint to 2023, spend-based emissions multipliers (sheet GHG_SIC_multipliers, OGL v3), 111 UK SIC 2007 groups x 2015-2023 | `data/sources/uk-spend-multipliers-sic-2015-2023.txt` (extract of the .ods, source URL and sha256 in its header) → `pnpm tsx scripts/build-uk-spend-factors.ts <extract> <migration>` (`lib/factors/uk-spend.ts`) → migration `20260924000027`. kg CO2e per £ at each year's basic prices excl. VAT; each year's factor is effective for that year with that price year (2015 open before, 2023 open after) |
| SustainMetrics | sustainmetrics.net/factors | Not loaded: needs an API key and re-publishes DEFRA/EPA/ADEME, so the sources are loaded directly |

Library records are seeded; actual factor rows loaded via admin import. Methodology: `ghg-protocol-v2026-02` (changelog in `lib/calculation/methodology.ts`), GWP AR6.

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

## Decisions and open items

1. **Emission factor licensing** — settled. DEFRA/DESNZ factors are Open Government Licence v3.0 (commercial reuse allowed with attribution); EPA factors are a US Government work (public domain). ADEME Base Carbone is Licence Ouverte v2.0 (Etalab; commercial reuse allowed with attribution). Every report and CSV carries the attribution from the library's `license` field (`lib/reports/attribution.ts`). SustainMetrics is not loaded; confirm its terms before adding it.
2. **Methodology versioning** — settled; the policy is in `lib/calculation/methodology.ts`. Bump (new `methodology_versions` row via migration plus a `METHODOLOGY_CHANGELOG` entry) only for rule changes that alter a figure from the same records and library: GWPs, Scope 2 allocation, spend conversion/deflation, fuel/unit conversion, headline scope. Not for factor libraries (tracked per run), layout, or bug fixes. Snapshots keep their version; the dashboard lists periods published under an older one.
3. **Billing** — open. Stripe (test mode) is wired: `lib/billing/stripe.ts` (one customer per org via search + idempotency key; subscriptions `default_incomplete` with 3-D Secure confirmed client-side; `createBillingPortalSession()`), `app/api/webhooks/stripe/route.ts` (events recorded in `stripe_webhook_events` and skipped on redelivery; the plan changes only while `active`/`trialing`; a deleted subscription returns starter/growth orgs to `trial`), `POST /api/orgs/{orgId}/billing/portal`. Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` (exposed to the browser as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` by `next.config.ts`), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{STARTER,GROWTH}_{MONTHLY,ANNUAL}`. Stripe sandbox `acct_1UJBAjQy6Pcb0KAI` ("MetricOra sandbox", used by Preview/Development): products Starter `prod_VJq3cmaU76NZuv` and Growth `prod_VJq4qV8MmPTjpy`, prices with lookup keys `starter_monthly`, `starter_annual`, `growth_monthly`, `growth_annual` (GBP, tax exclusive; Stripe Tax head office Holmfirth, GB, with no VAT registration, so no VAT is added until one is registered), webhook `we_1UJD3dQy6Pcb0KAImwqLGlZx` (replaced `we_1UJCPZQy6Pcb0KAIyvta5PrP`, disabled, whose secret did not match Vercel); verified end to end on 24 September 2026: subscription created, invoice paid and subscription deleted events were each answered 200 and recorded in `stripe_webhook_events`, default portal configuration `bpc_1UJCPkQy6Pcb0KAI3rXU7o8Y`. The live account `acct_1UJBAIQvEdJSkNgy` has the same products and prices (Starter `prod_VJrSAofpSEBfyh`: `price_1UJDjtQvEdJSkNgyKKFb60wH` monthly, `price_1UJDkSQvEdJSkNgyjX7zsSQe` annual; Growth `prod_VJrSRJbVtXHHVm`: `price_1UJDjxQvEdJSkNgy6Uh8qfKf` monthly, `price_1UJDkWQvEdJSkNgy1Pqq3Nv1` annual; same lookup keys) webhook `we_1UJDnpQvEdJSkNgyzAmK0xK5` (same URL and events), default portal configuration `bpc_1UJDqBQvEdJSkNgyvaaAbARd` and the same tax head office. Checkout finds prices by lookup key in whichever account `STRIPE_SECRET_KEY` belongs to (`resolvePriceId()`; the webhook maps plans with `planForSubscription()`), so going live is only a key change on Production; the `STRIPE_PRICE_*` env vars are a fallback. `STRIPE_WEBHOOK_SECRET` may hold several secrets, comma-separated (`webhookSecrets()` in `lib/billing/stripe.ts`); Production holds the sandbox and live endpoints' secrets, Preview/Development the sandbox one. Pricing (founder/pricing-strategy.md): per organisation, Starter £99/mo or £990/yr (3 sites, 5 web users), Growth £299/mo or £2,990/yr (15 sites, 25 users), Enterprise from £750/mo billed annually; 30-day trial with Growth features. Field workers and supplier logins are never counted. `requireCapacity()` enforces sites and web users on facility create and member invite; `requireFeature()` gates social value, bid carbon pack and PAS 2080 writes to Growth and above (reads stay open after a downgrade); pilots are exempt. Still open: failed-payment behaviour beyond Stripe's retries.
4. **Primary report format** — settled: the customer-facing GHG Protocol report is the default (`DEFAULT_REPORT_TYPE` in the report form); every emissions report ships the CSV calculation trail as the auditor's appendix.
5. **Spend factors and price years** — settled. EPA's published v1.3 NAICS-6 factors are loaded as the "EPA USEEIO 1.3" library (price year 2022, so spend is deflated). The seeded DEFRA `eeio-2025-*` and EPA 3-digit `useeio-v1.3-naics-*` factors have no traceable source and are flagged "Unverified" (migration `20260923000022`). ADEME's 2023 EUR ratios per NAF division are loaded (price year 2023; EUR spend is deflated with the euro area HICP). UK spend uses the Defra/University of Leeds multipliers by UK SIC group (2015-2023, each year at its own prices); Defra plans a different channel for them from 2027, so check the source each year.
6. **CPI table** (`lib/calculation/price-index.ts`) — GBP checked against ONS Table 15a (D7BT annual averages) to 2025; 2012-2014 were wrong and are corrected. USD 2012-2025 checked against the BLS API (CUUR0000SA0); 2025 is BLS's published annual average 321.943 (eleven months, no October 2025). EUR is Eurostat's euro area HICP annual average (prc_hicp_aind, 2015 = 100), 2012-2025 from the export of 6 February 2026; a factor whose country has its own index (France HICP, `COUNTRY_INDEX`) is deflated with that instead. Add each year's figures when published (January).
