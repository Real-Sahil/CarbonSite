# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement (set by the owner, standing instruction)

- **Replies in caveman style, always** (the `caveman` skill, level full): terse, fragments fine, all technical detail kept. Code, commits, PRs and docs stay in normal prose.
- **Always merge finished work to `main`.** After lint, typecheck, tests and build pass on the working branch, merge it into `main` (fast-forward when possible, otherwise a merge commit) and push `main`. No need to ask first. `migrate.yml` applies migrations when `main` moves, so the migration rules below still apply before merging.
- **Agent tooling:** ponytail (Claude Code plugin `ponytail@ponytail`, marketplace `DietrichGebert/ponytail`), superpowers (`superpowers@superpowers-marketplace`) and graphify are enabled for this repo in `.claude/settings.json`, so cloud sessions of this repo get them with no setup script. `scripts/dev-tools/install-agent-tools.sh` enables both for every project on a machine (user-scope `~/.claude`): run it once locally, or paste it into a cloud environment's setup script. The same script also enables **superpowers** (plugin from `obra/superpowers-marketplace`: brainstorm, plan, TDD and review skills; use it for large features, skip it for one-line fixes) and the **context7** MCP server (current docs for Next.js 16, Prisma, Better Auth, Tailwind 4, Remotion; optional free `CONTEXT7_API_KEY`). **Evaluated and not installed:** claude-mem (its installer defaults to a hosted memory account and cloud sync; this repo's sessions touch customer-adjacent data, so opt in per machine only with `--provider host` and `CLAUDE_MEM_ONLINE_OPTIN=false`), Comp AI and Papermark (AGPL: read for ideas, never copy code; management systems stay clean-room), pdfcn (React PDF components on Takumi/Forme; reports here render HTML through Chromium, so no fit), and the awesome-claude-skills and claude-skills catalogues (hundreds of skills cost context on every session; install single skills when a task needs one). Headroom is not auto-configured: it reroutes all model traffic through a local proxy (`ANTHROPIC_BASE_URL`), so it is an opt-in per machine (`headroom init claude --global`).

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

**No Docker. No paid subscriptions.** One deliberate exception: `api/forecast.py`, a stateless Prophet forecasting function deployed as a Vercel Python Function in this same project (no separate host, no Docker) — see "Forecasting" under Background Jobs below. Everything else is Node/TypeScript.
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

**Import column mapping:** one alias list, `lib/imports/column-mapper.ts`, serves the preview UI and the worker's fallback (`mapColumns()`); canonical field names (`emissionCategoryCode`, `spendAmount`) always map, which the connector CSV relies on. **Machine-to-machine ingest:** `POST /api/orgs/{orgId}/integrations/{utilities|fleet|corporate-cards|webhooks}/ingest` with an org API key. `lib/connectors/ingest.ts` turns connector output into a canonical CSV and runs the normal import pipeline, so the data waits in Imports for a person to commit it. A retried identical payload returns the first batch.

**ERP export profiles** (`lib/imports/profiles.ts`, Imports → ERP profiles): an `ImportProfile` per org (migration `20260928000053`) saves how a finance system's ledger export is laid out (date, account, cost code, net amount or quantity, supplier, site, reference; day/month order; 1,234.56 or 1.234,56) plus an `ImportProfileRule` table from ledger account and/or cost code (`5100`, `51*`, `5000-5099`; most specific wins, then list order) to an emission category, or ignore. Spend rules record the net amount in the currency (industry code from the rule, for spend factors); quantity rules record the quantity column with the rule's unit. `applyProfile()` runs in the import worker when the batch carries `profileSnapshot` (copied from the profile at upload, so editing a profile never changes a past import): lines no rule covers, credit lines and zero lines are staged `excluded` with the reason (the first two as warnings in the error CSV), ignored lines are recorded silently, and nothing is committed until a person commits. `POST /api/orgs/{orgId}/import-profiles/preview` reads a sample in memory and lists codes still needing a rule. Templates in `profile-templates.ts` (SAP, Causeway, COINS, Sage, other) are only candidate header names, unchecked against live exports, and ship no rules. Marketing may say "any ERP by export", not name a system as integrated.

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

**Annual sustainability report** (`sustainability_report`, `lib/sustainability-report/`, migration `20260929000056`): the large-contractor layout (modelled on how tier ones such as Sisk publish) from published snapshots and records only. Headline tiles (total, Scope 1 and 2 against the base year, Scope 3 share, largest source, intensity, waste diversion, National TOMs value; a tile appears only when its figure exists), a base year / previous / current emissions table (`yearTable()`), tonnes per million of the period's revenue and per FTE (`ReportingPeriod.revenueAmount`/`fteCount`; no revenue, no intensity), all 15 Scope 3 categories (`scope3Disclosure()`: a category with records is reported; one without takes the organisation's own status and reason from its Carbon Reduction Plan, else "No records in this period", **never "not applicable"**: only the organisation can say that), targets with reduction so far, measures, waste (`WasteRecord` only), social value by theme, assurance, sign-off and an ESRS index that lists only the sections present, under the statement that it is prepared with reference to ESRS and not presented as compliant. The carbon evidence comes from `loadBidPackData()` (no contracts); `load.ts` adds revenue, waste, social value themes and the CRP's boundary and Scope 3 notes. Starter plan and above (Essentials is CRP and GHG Protocol only). Not built yet: TCFD statement (scenarios, risk register), double materiality, highlights on EV share and HVO share of site fuel, waste and water intensity, a "progress against target" table for non-carbon targets.

**Climate disclosure (TCFD structure)** (`lib/climate-disclosure/`, sidebar → Carbon forecast → Climate disclosure, report `tcfd_statement`; migration `20260929000057`): one living `ClimateDisclosure` per org (governance, strategy, risk management and metrics narrative, time horizons and scenarios in `sections`, validated by `disclosureSectionsSchema`; board approval by admins, any later edit returns it to draft, like the transition plan) plus the org's `ClimateRisk` register (physical acute/chronic, transition policy/technology/market/reputation, opportunity; 1 to 5 likelihood and impact before and after the response; score is the product, up to 4 low, 9 medium, 15 high, then very high). `tcfdChecklist()` has one check per recommended disclosure (11) and says what is missing; emissions and targets are read from the published snapshot and the org's targets, never typed. The PDF claims it is consistent with the recommendations **only when all 11 are met and the board has approved this version** (`mayClaimConsistency()`), otherwise it says how many are addressed. **Built for any organisation in any country, not one company:** nothing is tied to a jurisdiction, currency or scenario set (scenario names are the org's own text; `SCENARIO_PRESETS` are public names offered as suggestions; financial effects are free text in the org's own currency), the framework note says whether a disclosure is required depends on where the org operates, and the TCFD recommendation text is not copied (labels and guidance are our own). Every query carries the organisation; `tests/security/climate-disclosure-tenancy.test.ts`. The report's idempotency hash includes the disclosure's and register's `updatedAt` and the risk count. Not built yet: a TCFD/IFRS S2 cross-reference table, value-at-risk figures, ESRS E1 datapoint resolvers for the register.

**Guided Carbon Reduction Plan** (`lib/crp/`, sidebar → Impact reports → Carbon Reduction Plan): one `CarbonReductionPlan` per org and reporting period (migration `20260925000034`) holding the PPN 006 template's own text in `sections` (boundary and exclusions, publication URL, baseline rationale, Scope 3 category explanations, net zero year and interim targets, completed and planned measures, optional SECR intensity and efficiency measures, director sign-off). Figures are never stored on it: `loadCrpContext()` reads the period's published snapshot, records and the active base year, and the page can calculate, publish and set the base year through the normal APIs. `crpReadiness()` lists what an evaluator checks; required items block generation. The `ppn_006_crp` report reads the plan when given `options.crpPlanId` (scoped to org and the report's period; `planVersion` in the options keeps an edited plan from returning a stale PDF). A new plan copies the latest plan's text. Form sections use `components/structured-forms/ms-fields.tsx`, the primitives shared with the method statement editor.

**Go-to-market plumbing:** (1) Opt-in verification line: a CRP's `organisation.showVerificationLine` (wizard checkbox under Declaration) makes the `ppn_006_crp` handler return `verificationLine`, and the worker stamps "Figures calculated from records in MetricOra. Verify this report:" with a link to the report's public verification page on the last page (`addVerificationLine()` in `lib/reports/pdf-generator.ts`); the verify page links to the site with `?ref=verify`. (2) Acquisition: `components/marketing/acquisition-carry.tsx` carries `?ref`/`utm_*` (else the external referrer host) onto internal links by rewriting the next URL only; nothing is stored in the browser (the cookie policy promises no tracking cookies). The sign-up form sends it as `acquisition` and `POST /api/orgs` stores `Organization.acquisitionSource/Medium/Campaign` (migration `20260925000036`; creation only, a malformed value is dropped). (3) `/platform/growth` (`lib/platform/growth.ts`): trials, trials with a ready `ppn_006_crp` or `secr` report, and paying orgs (Starter/Growth/Enterprise, pilots excluded) by week and by source. (4) "Start your Carbon Reduction Plan" links to `/sign-up?start=crp`, which lands the new org on the CRP page; onboarding shows the same shortcut.

**PPN 026 Social Value Model** (`lib/social-value/ppn026.ts`, contract page → PPN 026 Social Value Model): the central government model published 5 August 2026 for procurements from 1 January 2027 of £1m or more (Good Jobs: jobs, conditions, pay; Skills: training, progression, pipeline; minimum weighting 10%, 20% at £5m+). `POST /api/orgs/{orgId}/sv/frameworks/ppn-026` installs it into the org's own `SvFramework` engine (idempotent, slug `ppn-026`, version "August 2026"; when the autumn 2026 sub-criteria land, add a new version rather than editing). Contract KPIs are `SvCommitment` rows with `outcomeId` (migration `20260925000037`) pointing at a criterion; delivery is `SvActivity` entries (evidence uploaded through `POST /sv/activities/evidence`, stored as org evidence, kept as a download link; approved only, in the KPI's unit, dated up to the period end in the bid pack). `ppn026Checks()`: at least 3 KPIs on £5m+ contracts, targets with units, evidence on every approved entry. The bid carbon pack prints each featured contract's PPN 026 KPIs. Every id a commitment or activity names (contract, framework, criterion, period, owner, commitment, measure, facility) is checked against the org by `svRefsError()` (`lib/social-value/refs.ts`) on create and update. Field workers log delivery from the app (Capture → Social Value, `social_value_screen.dart`): `GET /api/orgs/{orgId}/my-sites/{siteId}/social-value` lists the open KPIs on the site's contract (cached per site for offline use); the submission (`documentType: social_value`, migration `20260925000040`, formData `commitmentId`/`quantity`/`activityDate`/`note`, optional photo) must name an open KPI on that contract (`socialValueSubmissionError()`, `lib/social-value/field-capture.ts`) and is booked into the period of its delivery date; approval creates an approved `SvActivity` (`fieldSubmissionId`, evidence links to the photo) instead of an ActivityRecord and runs no calculation. Notes and photos must not carry personal details (the app says so).

**Local spend** (`lib/social-value/local-spend.ts`, `local-spend-load.ts`, `geocode.ts`; sidebar → Social value → Local spend; migration `20260928000054`): the share of a site's supplier spend that went to businesses within N miles (default 20, max 250, straight-line) and to SMEs, the figure social value questions ask for. `SvSupplierLocation` holds where each supplier is based (name, UK postcode, coordinates, `sme` true/false/null; unique per org on `supplierKey()`, which ignores case, Ltd/Limited, "&" and punctuation). Postcodes become coordinates through postcodes.io (public, no key; only postcodes are sent), at save time for suppliers and at view time for the site. The summary counts GBP spend on `in_review` and `approved` activity records for the site that name a placed supplier; spend with no supplier name, an unplaced supplier or a non-GBP currency is reported beside the share, never inside it, and the page lists the unplaced suppliers by spend so they can be added. `GET /api/orgs/{orgId}/sv/local-spend?siteId=&radiusMiles=&from=&to=`, supplier register at `.../sv/local-spend/suppliers[/{id}]` (writes need admin, sustainability director/manager or contract manager, the `socialValue` plan feature and are audit-logged; `tests/security/local-spend-tenancy.test.ts`). Local workforce is deliberately not built here: it would need residence postcodes, which the commuting work avoids for GDPR reasons.

**Planning obligations** (`lib/social-value/obligations.ts`, `obligations-load.ts`, `obligations-api.ts`; sidebar → Social value → Obligations; migration `20260928000055`): `SvPlanningObligation` records what a Section 106 agreement or planning condition requires of a site (title, planning reference, authority, clause, type, optional site/contract/owner, target and unit, due date, open/met/waived). State is derived, never stored: met and waived win, an open obligation is overdue the day after its due date and due soon within 60 days (`obligationState()`). Delivery comes from an optional linked `SvCommitment`: its approved activities in the obligation's unit are summed; quantities in other units are not added and the page says so (`obligationProgress()`). Ids are plain columns checked against the organisation on every write (`obligationRefsError()`, `orgRefsMessage()` and `svRefsError()`) and joined in code, so there are no foreign keys beyond the organisation. `GET/POST /api/orgs/{orgId}/sv/obligations`, `PATCH/DELETE .../{id}` (writes need admin, sustainability director/manager or contract manager, the `socialValue` plan feature and are audit-logged; `tests/security/obligations-tenancy.test.ts`). Route files must not export helpers, so shared schemas live in `obligations-api.ts`.

**Find a Tender** (`lib/tenders/`, sidebar → Data → Tenders; contracts page → Import from Find a Tender): public OCDS API, no key, nothing about the org is sent. `fetchNotice()`/`fetchTenderReleases()` (the API's own `stages=tender` filter returns about a tenth of tender releases, so every release is read and filtered by tag; 300 ms between pages; a 429 with Retry-After over 10 s throws `FtsRateLimited`). `summariseRelease()` reads buyer, buyer type (UK_CA_TYPE on Procurement Act notices, else TED_CA_TYPE), value (signed contracts, else awards, else the estimate, else lots), CPV codes, ITL regions, deadline, contract period and suppliers. **Import**: `POST /api/orgs/{orgId}/contracts/find-tender` previews a draft with warnings (tender estimate, another supplier named, missing value or dates) and creates the contract on confirm; `Contract.ftsNoticeId` (migration `20260926000045`, unique per org) stops a second import. **Watch**: one `TenderWatch` per org (CPV prefixes, ITL region prefixes, title keywords, minimum value; Growth and above); the daily `tenders` monitor (`runTenderWatches()`, pg_cron 05:40 UTC) reads the feed once from the oldest last check (at most 7 days back), records open matches as `TenderOpportunity` rows (unique per org and notice, status kept on update) and moves `lastCheckedAt` only after a complete run. `tenderFlags()` says a Carbon Reduction Plan is likely only for a buyer that classes itself as central government (UK_CA_TYPE publicAuthorityCentralGovernment, TED MINISTRY or NATIONAL_AGENCY) over £5m a year (PPN 006), possible for any other buyer over £5m, and names the social value policy (PPN 002; PPN 026 for procurements from 1 January 2027 of £1m or more). "Start bid carbon pack" opens the report form prefilled (`?bid=1&bidTitle=&buyerName=&tenderReference=`); the form no longer defaults the net zero year to 2050, so the pack uses the plan's.

**Evidence tier and trace a figure:** `evidenceTier()` (`lib/data-quality/evidence-tier.ts`) labels each record Verified (primary data origin, evidence complete, approved), Partially verified (one missing, or reviewed secondary data with evidence) or Estimated; `summariseTiers()` weights by kg CO2e. Shown on the records table (`EvidenceTierBadge`), in the GHG Protocol report ("Evidence behind these figures"), as `data_origin`/`evidence_status`/`review_status`/`evidence_tier` columns in every CSV trail, and on `/orgs/{orgId}/lineage` ("Trace a figure": the published snapshot's headline split by tier, category totals from `CATEGORY_BREAKDOWN_DIMENSIONS`, then a category's calculations largest first with record, factor, formula, selection reason, warnings and evidence downloads; `GET /api/orgs/{orgId}/lineage`, paginated). Approved field submissions create records with `dataOrigin: invoiced` (migration `20260925000038` fixed older ones left at `estimated`).

**Add from a bill** (records page): `POST /api/orgs/{orgId}/evidence/bill` stores the upload as evidence (`storeEvidenceFile()`, deduplicated by checksum), reads it (`documentText()` in `lib/imports/parsers/pdf.ts`: the PDF text layer through pdf-parse 2.x's `PDFParse`, else Tesseract OCR with the English data shipped in `@tesseract.js-data/eng` and traced into the function by `outputFileTracingIncludes`; never fetched from a CDN; `OCR_FILES` in `next.config.ts` ships Tesseract's worker, LSTM cores and data to every OCR route: the include keys are globs, so dynamic segments are written `*`, never `[orgId]`; a scanned PDF is refused with `SCANNED_PDF` rather than sent to OCR) and runs `extractBill()` (`lib/evidence/bill-extractor.ts`, deterministic: consumption line over readings, rates and last year, per-field confidence, alternatives, supplier, invoice number, billing period). The result is saved as an `EvidenceClassification`; no record is created until the person confirms, then the page posts the record (`dataOrigin: invoiced`, `in_review`) and attaches the bill. Uploading evidence to a record sets its evidence status to complete. **Attach bills to existing records** (records page, `match-bills.tsx`): each uploaded bill is read the same way, then `GET /api/orgs/{orgId}/evidence/{evidenceId}/matches` ranks the org's records it could evidence (`lib/evidence/match.ts`: a record is a candidate only when the quantity agrees within 2% after unit conversion; supplier, billing period overlap and category raise the score; `CONFIDENT_MATCH` 80 is preselected); nothing is attached until the person confirms. **Bill inbox** (`lib/evidence/bill-inbox.ts`, migration `20260925000041`): an editor turns on `<token>@BILL_INBOX_DOMAIN` (`Organization.billInboxToken`, `POST /api/orgs/{orgId}/bill-inbox`, rotatable); Resend receives the mail and calls `POST /api/webhooks/resend-inbound` (`email.received`, Svix-signed with `RESEND_INBOUND_WEBHOOK_SECRET`, checked by `verifySvix()`); only mail from a current member in `INBOX_SENDER_ROLES` is accepted (others are audit-logged as `evidence.inbox_rejected`); PDF/photo attachments up to 10 MB are fetched from `GET /emails/receiving/{id}/attachments` and stored as evidence with a `BillInboxItem` (deduped per email and file). They are read and matched on the records page like uploads, then attached or dismissed. Needs `BILL_INBOX_DOMAIN`, `RESEND_INBOUND_WEBHOOK_SECRET` and `RESEND_API_KEY` on Vercel plus a Resend receiving domain and webhook; without `BILL_INBOX_DOMAIN` the inbox is hidden.

**Employee commuting** (`lib/commuting/`, sidebar → Data → Commuting): Scope 3 Category 7, distance-based, from site attendance and each site's anonymous travel survey. No home postcode is asked for or read (GDPR). `POST /api/orgs/{orgId}/commuting/attendance` reads a CSV/Excel sign-in export (MSite, Biosite, Sitemetric or a spreadsheet; `parseAttendance()` finds the date, person and employer columns, ignores any postcode column and says so, reads text dates day-first because `xlsx` is called with `raw: true`, counts one day per person per date) in memory and never stores it. Without `confirm` it returns a preview so the person ticks which employers are their own staff; with it, `importAttendance()` makes one `CommuteImport` per site and month (migration `20260925000043`, unique per site and month, deletable while none of its records is approved or calculated) and records per mode (`s3-commuting`, km, `transportMode` "Car"/"BEV"/"Motorbike"/"Bus"/"Rail" as matched by `factor-hint.test.ts`; `calculated`, `in_review`, `siteId`/`contractId`), with a CSV of days and survey averages by mode as evidence. Distance: the survey (`CommuteSurvey`/`CommuteSurveyResponse`, public page `/commute/{token}`, `POST /api/public/commute/{token}`, rate-limited, no identifying fields) asks mode, people in the vehicle, employer and the round trip home to site in miles (`roundTripMiles`, 0 to `MAX_ROUND_TRIP_MILES` 300, stored as `roundTripKm`, migration `20260927000052`; older answers have none and only count as people). `surveyDistances()` averages each answer's round trip at its own mode (car/van/BEV/motorbike factors are per vehicle.km, so divided by occupancy) into km per mode per day on site, from own staff's answers when there are `MIN_SURVEY_RESPONSES` (5) with a distance, else everyone's; with fewer the import is refused (`NOT_ENOUGH_ANSWERS`) rather than assume a distance. Vans use the average car factor (no van commuting factor in the library) and the note says so. Only own staff enter the inventory; subcontractor km (their answers, else everyone's) are kept in the import summary for project (PAS 2080 A5) views, never recorded.

**AI assistance** (`lib/llm/`, Settings → AI assistance): `llmClient` tries Groq (`GROQ_API_KEY`, `llama-3.3-70b-versatile`; never trains on inputs, Zero Data Retention on in its console) then Mistral (`MISTRAL_API_KEY`, `mistral-small-latest`; the workspace has opted out of training), each with a timeout; NVIDIA's hosted NIM trial was dropped because its terms exclude production use. Nothing is sent unless the organisation's admin turned it on (`Organization.aiAssistEnabled`, migration `20260926000044`, `PUT /api/orgs/{orgId}/ai-assist`, audit `org.ai_assist_changed`); every call site checks `aiAssistEnabled(orgId)` (report narratives, ecology narratives, category suggestion, social value extraction; the routes answer 409 `AI_ASSIST_OFF`). Prompts carry figures and document text, not the organisation's name or people's details. Figures never come from the model: `ungroundedNumbers()` (`lib/llm/grounding.ts`) rejects generated text containing a number the prompt did not, and the report is produced without it; PDFs label the wording as AI-assisted. `GET /api/admin/health/llm` (platform staff only) shows the providers and which one answered.

**OCR confidence in review:** the app sends per-field OCR confidence as `formData.__ocrConfidence__`; `POST /field-submissions` moves it to `ocrExtractedData.__confidence` (`sanitiseOcrConfidence()`, `lib/field-submissions/ocr-confidence.ts`). `ocrFieldChecks()` orders the review page's Document verification table weakest first (red: read below `LOW_OCR_CONFIDENCE` 0.6 and not corrected; amber: changed after reading) and the queue shows "Check N fields". App builds before this change send no confidence, so their rows show "-".

**Organisation commitments in reports** (`lib/reports/commitments.ts`, `loadOrgCommitments()`): PPN 06/21, NHS Evergreen, CDP, ESRS E1, SECR and the bid carbon pack take the net zero year, interim targets, measures, signatory, SECR efficiency measures, base year and internal carbon price from the organisation's records (the period's Carbon Reduction Plan, then the transition plan, then the latest plan; reduction initiatives; the active base year; `appraisalPrice()`), with report form options overriding. A value never recorded prints as missing, never a default such as "net zero by 2050". Market-based Scope 2 prints "Not calculated" when no record in the run was market-based (`hasMarketBasedScope2()`). SECR shows the previous period's latest snapshot beside this year's. The contract carbon report uses the contract's own GBP value for intensity. **CBAM is withdrawn**: the route answers 422 `REPORT_TYPE_UNAVAILABLE` because the platform records no import declarations (CN code, origin, tonnes, installation emissions); the old handler estimated them from purchased goods.

**ESRS E5 without a waste register:** when a period has no `WasteRecord` rows, the E5 report uses the tonnes on the run's `s3-waste` activity records (`wasteRowsFromRecords()`, `lib/waste/from-records.ts`; t and kg only). Route and hazard status come only from the record's own text (a route word, an EWC code with or without `*`), never from the factor the calculation chose; unknown ones print "Not recorded" and diversion is a share of tonnes with a known route.

**Regulatory calendar** (`compliance/deadlines/page.tsx`): each entry carries its official `source` and the page shows `LAST_CHECKED`. Recheck dates and thresholds each quarter and move `LAST_CHECKED`.

**Report picker:** the report form shows `CORE_REPORT_TYPES` first (GHG Protocol, PPN 006 CRP, SECR, and the bid carbon pack where the plan includes it); every other type is under "Show all report types".

**Base year units:** base years, recalculations and restatements store tCO2e. `computePeriodTotals()` divides DashboardAggregate kg by 1000; migration `20260925000035` converted rows written in kg before that fix.

**Bid carbon pack** (`bid_carbon_pack` report, `lib/bids/carbon-pack.ts`): the carbon section of a tender in one PDF: a PPN 006 Carbon Reduction Plan, emissions trend across published snapshots, up to five featured contracts (emissions, intensity, budget, waste diversion, and National TOMs committed vs delivered by theme and top measures from `summariseSocialValue()`, with a per-contract answer from `contractAnswer()`), assurance status and model answers. Contract social value covers periods ending on or before the snapshot's period end. Every figure comes from published snapshots or org records; nothing is estimated or written by an LLM, and a section with no data is left out. `bidPackReadiness()` runs from the report form's Validate button and blocks a pack with no base year, director sign-off or net zero year by 2050.

### Marketing site (`app/(marketing)`)
- **One system:** build pages from `components/marketing/kit.tsx` (Section tones dark/paper/light, H1/H2/Lead, `ButtonLink` primary then secondary, then `TextLink`, `ProductShot`/`ProductLoop`, `ClosingCta`). Tokens are the `--color-mk-*` block at the top of `app/globals.css`: graphite ink, cool off-white, one ember accent (`mk-accent` fills with white text, `mk-accent-lit` for text on dark). Geist only. Long-form text uses `.mk-prose`; legal pages use `LegalShell`. Nav groups live in `NAV` in `site-nav.tsx`; the sitemap lists pages by hand in `app/sitemap.ts`.
- **Only real product and real claims:** screenshots and background loops in `public/marketing/{screens,loops}` are captured from the local demo tenant (Northgate Civils Ltd, fictional, labelled "demo data") with `scripts/marketing/record-loops.mjs`; activity comes from `scripts/marketing/demo-activity-csv.py` through the normal import and calculation pipeline. No invented testimonials, customer metrics, competitor comparisons or statistics. Every factor value, feature and plan limit quoted must match the code (plan copy follows `PLAN_FEATURES`/`PLAN_LIMITS`).
- **Demo analytics** (`components/marketing/demo-analytics.tsx`, home page and `/product#analytics`): the demo tenant's FY2025 totals, scope split and seven largest categories, copied from its dashboard and analytics captures, drawn as bars that grow when scrolled into view (no transition under reduced motion). Update the constants whenever the screenshots are recaptured; never add a figure the demo tenant does not show.
- **Chart colours:** one scope palette, `SCOPE_COLORS` in `components/charts/palette.ts` = `--color-scope-1..3` (teal `#0B8F80`, ember `#E0692A`, blue `#3B6FD4`), checked with the dataviz palette validator on light and dark. App charts and marketing use it; the PDF report templates still carry their own print palette.
- **Launch film** (home page hero, `components/marketing/launch-film.tsx`): built in code in `videos/` (Remotion, its own npm package, excluded from the app's tsconfig, lint and tests; `videos/BRAND.md` holds its rules). Its product screens are redrawn from the demo tenant screenshots with the same tokens, not captured, and every figure is the demo tenant's (labelled demo data). The hero plays `public/marketing/film/launch-720.webm` muted with an MP4 fallback; "Play with sound" swaps to the 1080p cut (WebM with Opus, MP4 fallback) inside the click so the browser allows audio. The score is original (`videos/scripts/compose.py`). Re-render with `cd videos && npm run setup && npm run render` and copy the outputs into `public/marketing/film/`.
- **Report types:** every type with a handler in `lib/reports/registry.ts` (`hasTypedTemplate()`) renders its own HTML layout through headless Chromium; if Chromium fails, `lib/reports/worker.ts` falls back to the generic PDFKit report from the handler's `pdfkitData` and logs a warning. `inventory` has no template and is always PDFKit. Template figures come from the run (library, methodology, GWP) and org records (base year, SBTi target); SECR energy is computed from the run's records by `secrEnergyFromCalculations()` (`lib/reports/secr-energy.ts`, litres at DESNZ 2025 gross CV) unless the form supplies it.
- **Field app availability:** Android is live on Google Play (`app.metricora.metricora_mobile`); iOS (`app.metricora.metricoraMobile`) is in App Store review. Do not link or claim the App Store until it is approved. The iOS app is iPhone-only (`TARGETED_DEVICE_FAMILY = 1`, build 1.0.6+10) so App Store Connect asks for iPhone screenshots only; they must be raw iOS captures (no Android bars, no device frame, no wallpaper) at 1290x2796, from the demo tenant, never real customer or project names.
- Removed pages (comparison, case studies, `/calculation`, the old blog posts) redirect in `next.config.ts`.

**Assurance pack** (`lib/assurance/pack.ts`): `GET /api/orgs/{orgId}/snapshots/{snapshotId}/assurance-pack[?engagementId=]` (admin, sustainability leads, reviewer, auditor; audit-logged) streams a ZIP built with `archiver`: README (snapshot, run, libraries, methodology, evidence tier split of the headline), `calculations.csv` (every stored calculation in the run with factor, selection reason, formula, warnings, provenance, tier), `factors.csv`, `evidence-index.csv` plus `evidence/` (files up to `MAX_EVIDENCE_BYTES`, 200 MB), `samples.csv` for an engagement, `audit-log.csv` from the period start with the hash chain, and `manifest.sha256`. Nothing is recalculated. Linked from the engagement page and Trace a figure.

**Management systems** (`lib/management-systems/`, sidebar → Compliance → Management systems): clean-room, no code or data from Comp AI (AGPL). The catalogue lives in the repo (`catalogue/*.ts`, one `CatalogueFramework` per edition, slug such as `iso-14001-2015`); organisations adopt a framework (`MsFrameworkAdoption`), record a status per requirement (`MsRequirementStatus`: not started, in progress, implemented, not applicable with a reason) and link evidence (`MsEvidenceLink`: their own evidence files, legal register, aspects, permits, incidents, H&S reports, method statements, targets, found with the organisation in the WHERE clause by `findRecordLabel()`; or a URL or note). Migration `20260927000046`. Headings (codes with children) are not assessed; `readiness()` leaves not-applicable out of the denominator and counts implemented requirements without evidence. `signals.ts` shows live figures from the organisation's records beside a requirement; they never set its status. Requirements that ask the same thing across standards share a `sharedKey` (`hls:9.2` is internal audit in ISO 9001, 14001 and 45001) and link to each other. **Content rules:** ISO, SOC 2, PCI DSS and NEN are copyrighted: clause references, short titles and our own guidance only, never the standard's text (`contentBasis: "references"`, enforced by `catalogue.test.ts`). Laws and public-domain frameworks may carry `officialText` only when a build script copied it from the official `sourceUrl`; never type official text by hand. Loaded (16): ISO 14001, 45001 and 9001 (each with Amd 1:2024, climate change in 4.1/4.2), ISO/IEC 27001:2022 (clauses plus 93 Annex A controls, filter "Annex A") and 42001:2023 (38 Annex A controls; both built on `harmonizedClauses()` in `catalogue/hls.ts`), SOC 2 (2017 TSC, filter by category), PCI DSS v4.0.1 (12 requirements and their sections), Cyber Essentials (five controls), UK GDPR (as amended by the Data (Use and Access) Act 2025, including 8A and 22A-22D; transfers as one requirement because both old and new Chapter V articles appear on legislation.gov.uk; plus the ICO fee), EU GDPR, CCPA/CPRA, PIPEDA, NIS2, HIPAA (Security Rule standards and implementation specifications tagged Required/Addressable per the eCFR of 23 September 2026, breach notification, main Privacy Rule duties), NIST CSF 2.0 and NIST SP 800-53 Rev 5. **Laws** carry official article/section numbers and titles (checked against the official texts on 26 September 2026), our own summary and a `url` to the official provision, not copied text. **NIST** is the only official text: `pnpm tsx scripts/management-systems/build-oscal.ts <sp800-53|csf> <usnistgov/oscal-content json dir>` writes `catalogue/generated/*.json` with the source version and sha256; 800-53 requirements are tagged with NIST's Low/Moderate/High/Privacy baselines from the resolved profiles. Not loaded: NEN 7510 (paid standard we cannot check) and the Saudi NCA Cloud Cybersecurity Controls. **Organisation control of the guidance** (migration `20260927000048`): every framework page states that the guidance is MetricOra's summary, not legal advice, and asks for review by the organisation's competent person. `MsRequirementStatus.interpretation` is the organisation's own reading, shown to its team in place of our guidance (ours stays, collapsed). `PATCH .../management-systems/{slug}` with `guidanceReviewed: true` records who reviewed it, when, a note and `catalogueFingerprint()` of the framework; when we change that framework's catalogue the review shows as out of date. **Plan limit:** frameworks adopted at once (`PlanLimits.frameworks`: trial 3, Starter 1, Growth 5, Enterprise unlimited; withdrawn ones not counted; pilots exempt), enforced on adoption by `requireCapacity(orgId, "frameworks")`; registers, PQQ answers and the field app capture are not limited. **Editions:** ISO 14001:2026 (published 15 April 2026; 2015 certificates move by 30 April 2029) and ISO 9001:2026 (16 September 2026) are their own frameworks built from the 2015 catalogues with `revise()` (`catalogue/revise.ts`); each changed clause carries `editionChange` (new, changed, renumbered, from which old codes) and the framework cites its `editionSources` (certification body notes, not the standard). "Start transition" (`POST .../management-systems/{new}/transition`, `lib/management-systems/transition.ts`) adopts the new edition beside the old and carries statuses, notes, interpretations and evidence by clause; merged clauses take the least advanced state and anything new or changed is left in progress. `SUPERSEDED_BY` in `catalogue/editions.ts` (kept in step by a test) makes both editions count once against the plan. ISO 45001's revision is due in 2027; the data upkeep workflow watches ISO's pages for new editions and Build UK's for a new CAS question set. **Registers** (migrations `20260927000047` and `20260927000049`, `/orgs/{orgId}/management-systems/registers/{key}`, grouped plan / support / operate / check and improve by `REGISTER_GROUPS`): risks and opportunities, interested parties, objectives, planned changes (6.3), policies, controlled documents (7.5), competence requirements, training records, equipment and calibration, supplier evaluations, inspection checklists, inspections, internal audits, audit findings, complaints, nonconforming outputs, corrective actions and management reviews. One definition per register in `registers/config.ts` drives the zod schema, the API (`/api/orgs/{orgId}/management-systems/registers/{key}[/{id}]`) and the generic table and form (field types include number, file, person, row reference and checklist); `registers/server.ts` checks every member, row and file id against the organisation, applies the rules (editing an approved policy's or document's title, text or file starts a new draft version; approval records who and when; a corrective action cannot close without an effectiveness note), works out training expiry from the competence's validity and equipment's next due date from its interval (`enrich()`), raises one corrective action for an inspection's failed items (`afterSave()`), refuses to delete a competence or checklist still in use (`REFERENCED_BY`), and counts all registers in one statement (`registerCounts()`). Policies and documents can be acknowledged per version (`MsAcknowledgement`, `POST .../registers/{key}/{id}/acknowledge`). Files upload through `POST .../management-systems/files` as org evidence. The training matrix (`lib/management-systems/training.ts`, page `training-matrix`) shows valid, expiring (60 days) and expired per person and competence. Register figures show beside the shared ISO clauses (`SHARED_SIGNALS` in `signal-keys.ts`). **Reminders:** the daily `management-systems` monitor (pg_cron, migration `20260927000050`, `lib/management-systems/reminders.ts`) sends `ms_reminder` notifications 14 days before and after every register date named in a register's `reminders`, requirement due dates, certificate expiry (90 days) and RIDDOR reports not yet made to HSE (`riddorDeadline()`: 15 days from the incident for an over-7-day injury, 10 days for anything else), to the owner or the management system editors, once each (`MsReminderLog`). **Certification:** the pack (`GET .../management-systems/certification-pack?frameworks=`, `lib/management-systems/certification-pack.ts`) is a ZIP of requirement status per framework, a Statement of Applicability for Annex A standards, every in-scope register, the training matrix, the files behind them (200 MB) and a SHA-256 manifest. Auditor links (`MsAuditorAccess`, `POST .../management-systems/auditor-access`, page `certification`): 1 to 90 days, scoped to adopted frameworks, token shown once and stored as SHA-256, revocable; `/ms-audit/{token}` is a read-only noindex page and `/api/public/ms-audit/{token}/files/{id}` serves only files the link's pack draws on (`packEvidenceFileIds()`); every use is rate-limited and audit-logged. The integrated view (`lib/management-systems/integrated.ts`, page `integrated`) lines up shared clauses across adopted standards and flags differing statuses. **Pre-qualification** (`lib/pqq/`, page `management-systems/pqq`): 142 answer topics (`topics.ts`) answered once per organisation (`PqqAnswer`) and reused by every questionnaire: the Build UK Common Assessment Standard v5 (all 176 question numbers mapped in `catalogue/cas.ts`; the question text is Build UK's and is never stored) and clients' own questionnaires pasted in (`PqqQuestionSet`; `suggestTopic()` maps each question, an unmatched one gets its own `custom:<hash>` answer). `draft.ts` suggests answers only from facts the records hold (approved policies, certificates or readiness, training matrix, incidents with RIDDOR counts, supplier evaluations, audits and reviews, legal register, the latest published total via `computePeriodTotals()`, the Carbon Reduction Plan); nothing is saved until a person saves it. The answer pack ZIP (`GET /api/orgs/{orgId}/pqq/export?set=`) lists every question reference with its answer and documents. Bid and contract managers answer alongside the editors (`PQQ_EDITORS`). **Field app:** hazard and near-miss reports (`hazard_report`) and checklist inspections (`site_inspection`, checklists from `GET /api/orgs/{orgId}/inspection-checklists`, cached for offline use) are field submissions (migration `20260927000051`, `lib/field-submissions/safety-capture.ts`, Flutter `site_safety_screen.dart`); approval raises a corrective action (plus a near-miss `HsIncidentReport`) or records an `MsInspection`, never an ActivityRecord. The remaining roadmap is in `docs/MANAGEMENT_SYSTEMS_GAP_PLAN.md`.

### Data quality guards
- **Duplicates** (`lib/data-quality/duplicates.ts`): a record with the same category, amount, unit, date, facility and supplier as an existing one is refused with 409 `POSSIBLE_DUPLICATE` unless sent with `allowDuplicate` (the record form asks); imports flag such rows, and rows repeated within the file, as warnings. Facility names are unique per org (case-insensitive, 409 `FACILITY_EXISTS`).
- **Unpublished changes:** when live aggregates differ from the period's latest snapshot, the dashboard shows the signed difference above the headline with a link to review and publish the latest run.

### Data upkeep
`.github/workflows/data-upkeep.yml` runs every Monday. **watch** (`scripts/data-watch/check.mjs --issues`) compares what the repo has loaded with each publisher: DESNZ/DEFRA conversion factors (GOV.UK content API against `RELEASES` in `scripts/build-defra-factors.mjs`), the UK carbon footprint spend multipliers, the EPA GHG Emission Factors Hub, EPA Supply Chain factors (USEPA/supply-chain-factors releases), ADEME Base Carbone (data.ademe.fr metadata), and the regulatory calendar's `LAST_CHECKED`. Each new release, and each watcher that fails, opens one issue labelled `data-upkeep` with the steps to load it; open issues are not duplicated. Loading factor data stays manual (row names change between releases). **cpi** (`scripts/data-watch/update-cpi.mjs`) refreshes the GBP/USD/EUR/FR tables in `price-index.ts` from ONS, BLS and Eurostat, adding complete years only; a value that disagrees with the table stops it (a clean rebase replaces the series) and opens an issue; changes go to the PR "Data upkeep: CPI update" on branch `data-upkeep/cpi`. When you load new data, update `data/sources/watched-sources.json` (or `RELEASES`) in the same PR. Pure logic and parsers: `scripts/data-watch/lib.mjs`, tested in `scripts/data-watch/__tests__`. Repo settings: Actions need read/write permission and "Allow GitHub Actions to create and approve pull requests"; a `DATA_UPKEEP_TOKEN` secret makes CI run on the CPI PR; `BLS_API_KEY` is optional.

### Code health and monitoring
- **Knip** (`knip.json`, `pnpm knip`, CI web job): fails on unused files, unused or unlisted dependencies and unresolved imports. Unused exports are not gated yet. A dependency used only by config or CSS (`tailwindcss`, `sharp`, `kysely` as Better Auth's peer) is listed in `ignoreDependencies`; anything else flagged is deleted, not ignored.
- **Security scan** (`.github/workflows/security-scan.yml`): Gitleaks (pinned, checksum-verified, config `.gitleaks.toml`) blocks on secrets in the tree and in a pull request's own commits; allowlist entries must be narrow and say why, and a real credential is rotated, never allowlisted. OSV-Scanner (pinned CLI, checksum-verified) lists known vulnerabilities for every lockfile in the job summary and warns without failing the build until its first results are triaged (exit code 1 then becomes a failure); it does not depend on code scanning or artifact storage; `pnpm audit` in ci.yml still blocks high-severity production advisories.
- **Accessibility** (`tests/e2e/a11y.spec.ts`, CI e2e-local job): axe-core WCAG 2.1 A/AA on the home, product, pricing, methodology, security, sign-in and sign-up pages of the PR's own build. Inline links need an underline, not colour alone; dim text on the dark auth screens is `text-white/60` or brighter.
- **Private repository, metered minutes:** the repo is private, so Actions minutes count against the plan (2,000 a month on Free; every job bills at least a minute; macOS jobs bill 10x, which is why `mobile-build.yml` is manual). CodeQL (`codeql.yml`) is manual only because its results cannot be uploaded without Advanced Security; Gitleaks, OSV-Scanner and `pnpm audit` cover secrets and dependencies on every change. Do not add scheduled workflows that run more than a few times a day; use a free external monitor for uptime. **Artifact storage** is 500 MB on the Free plan and was once 33 GB of old Android builds, which made the iOS release's artifact upload fail ("Artifact storage quota has been hit"). Release artifacts now expire after 3 days, the signed-IPA artifact step is `continue-on-error` so it can never stop the App Store Connect upload that follows it, and the manual "Clear old build files" workflow (`clear-build-artifacts.yml`) deletes everything but the newest artifact of each name (GitHub recalculates usage 6 to 12 hours later).
- **CI budget** (`ci.yml`): one run per change (pull requests on `pull_request`, main on `push`; a newer push cancels the older run). The production build happens once, in the e2e-local job, which then runs every Playwright spec (pilot cycle, smoke, accessibility) against it. The Python forecast tests and the Flutter checks run only when their paths change (`changes` job). No CI job points at the live site; `uptime.yml` does that.
- **Uptime** (`.github/workflows/uptime.yml`): every 6 hours checks `/`, `/sign-in` and `/api/health` (`"status":"ok"`, a database round trip) with three tries; a failure opens one `uptime` issue and a pass closes it. `/api/health` never returns the error text.

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
- Prisma has one connection per function instance (`connection_limit=1`), so queries in a `Promise.all` still run one after another and each costs a database round trip. Cut the number of queries, not their order: the dashboard reads its counts, the latest run's data quality figures and published libraries with one statement each (`lib/dashboard/page-data.ts`, checked against the Prisma queries they replaced by `tests/golden/dashboard-page-data.test.ts`), and `getSession()`/`requireOrgMember()` are wrapped in React `cache()` so a layout and its page share one lookup.
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

## Decisions and open items

1. **Emission factor licensing** — settled. DEFRA/DESNZ factors are Open Government Licence v3.0 (commercial reuse allowed with attribution); EPA factors are a US Government work (public domain). ADEME Base Carbone is Licence Ouverte v2.0 (Etalab; commercial reuse allowed with attribution). Every report and CSV carries the attribution from the library's `license` field (`lib/reports/attribution.ts`). SustainMetrics is not loaded; confirm its terms before adding it.
2. **Methodology versioning** — settled; the policy is in `lib/calculation/methodology.ts`. Bump (new `methodology_versions` row via migration plus a `METHODOLOGY_CHANGELOG` entry) only for rule changes that alter a figure from the same records and library: GWPs, Scope 2 allocation, spend conversion/deflation, fuel/unit conversion, headline scope. Not for factor libraries (tracked per run), layout, or bug fixes. Snapshots keep their version; the dashboard lists periods published under an older one.
3. **Billing** — open. Stripe (test mode) is wired: `lib/billing/stripe.ts` (one customer per org via search + idempotency key; subscriptions `default_incomplete` with 3-D Secure confirmed client-side; `createBillingPortalSession()`), `app/api/webhooks/stripe/route.ts` (events recorded in `stripe_webhook_events` and skipped on redelivery; the plan changes only while `active`/`trialing`; a deleted subscription returns starter/growth orgs to `trial`), `POST /api/orgs/{orgId}/billing/portal`. Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` (exposed to the browser as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` by `next.config.ts`), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{STARTER,GROWTH}_{MONTHLY,ANNUAL}`. Stripe sandbox `acct_1UJBAjQy6Pcb0KAI` ("MetricOra sandbox", used by Preview/Development): products Starter `prod_VJq3cmaU76NZuv` and Growth `prod_VJq4qV8MmPTjpy`, prices with lookup keys `starter_monthly`, `starter_annual`, `growth_monthly`, `growth_annual` (GBP, tax exclusive; Stripe Tax head office Holmfirth, GB, with no VAT registration, so no VAT is added until one is registered), webhook `we_1UJD3dQy6Pcb0KAImwqLGlZx` (replaced `we_1UJCPZQy6Pcb0KAIyvta5PrP`, disabled, whose secret did not match Vercel); verified end to end on 24 September 2026: subscription created, invoice paid and subscription deleted events were each answered 200 and recorded in `stripe_webhook_events`, default portal configuration `bpc_1UJCPkQy6Pcb0KAI3rXU7o8Y`. The live account `acct_1UJBAIQvEdJSkNgy` has the same products and prices (Starter `prod_VJrSAofpSEBfyh`: `price_1UJDjtQvEdJSkNgyKKFb60wH` monthly, `price_1UJDkSQvEdJSkNgyjX7zsSQe` annual; Growth `prod_VJrSRJbVtXHHVm`: `price_1UJDjxQvEdJSkNgy6Uh8qfKf` monthly, `price_1UJDkWQvEdJSkNgy1Pqq3Nv1` annual; same lookup keys) webhook `we_1UJDnpQvEdJSkNgyzAmK0xK5` (same URL and events), default portal configuration `bpc_1UJDqBQvEdJSkNgyvaaAbARd` and the same tax head office. Checkout finds prices by lookup key in whichever account `STRIPE_SECRET_KEY` belongs to (`resolvePriceId()`; the webhook maps plans with `planForSubscription()`), so going live is only a key change on Production; the `STRIPE_PRICE_*` env vars are a fallback. `STRIPE_WEBHOOK_SECRET` may hold several secrets, comma-separated (`webhookSecrets()` in `lib/billing/stripe.ts`); Production holds the sandbox and live endpoints' secrets, Preview/Development the sandbox one. Pricing (founder/pricing-strategy.md): per organisation, Essentials £199/yr (yearly only, lookup key `essentials_annual`, sandbox `prod_VLIOoytlvaKia3` / live `prod_VLIPGamvKq2pte`; 1 site, 2 web users, no management system frameworks, only the `ppn_006_crp` and `ghg_protocol` reports via `requireReportType()`: the entry tier against £199/yr CRP-only tools), Starter £99/mo or £990/yr (3 sites, 5 web users), Growth £299/mo or £2,990/yr (15 sites, 25 users), Enterprise from £750/mo billed annually; 30-day trial with Growth features. Field workers and supplier logins are never counted. `requireCapacity()` enforces sites and web users on facility create and member invite, and management system frameworks on adoption (Starter 1, Growth 5); `requireFeature()` gates social value, bid carbon pack and PAS 2080 writes to Growth and above (reads stay open after a downgrade); pilots are exempt. Failed renewals (`lib/billing/dunning.ts`): `invoice.payment_failed` sets `BillingSubscription.paymentFailedAt` (first failure only) and sends admins a `payment_failed` notification; admins see a banner in the org layout. `PAYMENT_GRACE_DAYS` (14) of full access from the first failure, then while `past_due` (at once if `unpaid`/`incomplete_expired`) `requireActiveBilling()` returns 402 `PAYMENT_OVERDUE` on the gated creation routes; reading and exports stay open. `invoice.payment_succeeded` clears it. Keep Stripe's failed-payment customer emails on in the Dashboard.
4. **Primary report format** — settled: the customer-facing GHG Protocol report is the default (`DEFAULT_REPORT_TYPE` in the report form); every emissions report ships the CSV calculation trail as the auditor's appendix.
5. **Spend factors and price years** — settled. EPA's published v1.3 NAICS-6 factors are loaded as the "EPA USEEIO 1.3" library (price year 2022, so spend is deflated). The seeded DEFRA `eeio-2025-*` and EPA 3-digit `useeio-v1.3-naics-*` factors have no traceable source and are flagged "Unverified" (migration `20260923000022`). ADEME's 2023 EUR ratios per NAF division are loaded (price year 2023; EUR spend is deflated with the euro area HICP). UK spend uses the Defra/University of Leeds multipliers by UK SIC group (2015-2023, each year at its own prices); Defra plans a different channel for them from 2027, so check the source each year.
6. **CPI table** (`lib/calculation/price-index.ts`) — GBP checked against ONS Table 15a (D7BT annual averages) to 2025; 2012-2014 were wrong and are corrected. USD 2012-2025 checked against the BLS API (CUUR0000SA0); 2025 is BLS's published annual average 321.943 (eleven months, no October 2025). EUR is Eurostat's euro area HICP annual average (prc_hicp_aind, 2015 = 100), 2012-2025 from the export of 6 February 2026; a factor whose country has its own index (France HICP, `COUNTRY_INDEX`) is deflated with that instead. The Data upkeep workflow adds each year's figures when published (January) and opens a PR.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships. It is not committed: `.claude/hooks/graphify-init.sh` (SessionStart) installs or upgrades the CLI in cloud sessions, installs graphify's git hooks (rebuild after every commit and checkout) and rebuilds the graph in the background, so it can lag a fresh session by about a minute.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- The git hooks rebuild the graph after each commit; run `graphify update .` yourself only to query uncommitted changes (AST-only, no API cost).
