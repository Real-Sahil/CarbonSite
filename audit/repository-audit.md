# Fluid Enterprise Sustainability Intelligence Platform
## Repository Audit & Transformation Roadmap

**Prepared by:** Engineering  
**Date:** 2026-06-13  
**Repository:** real-sahil/metricora (`main`, commit `8191156`)  
**Current Brand:** MetricOra (MVP)  
**Target Brand:** Fluid  
**Classification:** Internal — Engineering Confidential

---

## Table of Contents

1. [Repository Audit](#1-repository-audit)
2. [Data Flow Map](#2-data-flow-map)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Database Schema Review](#4-database-schema-review)
5. [API Review](#5-api-review)
6. [Multi-Tenant Review](#6-multi-tenant-review)
7. [White-Label Review](#7-white-label-review)
8. [RBAC Matrix](#8-rbac-matrix)
9. [OCR Architecture](#9-ocr-architecture)
10. [DEFRA Carbon Engine Review](#10-defra-carbon-engine-review)
11. [Social Value Engine Review](#11-social-value-engine-review)
12. [Dashboard Dependency Map](#12-dashboard-dependency-map)
13. [Reporting Workflow](#13-reporting-workflow)
14. [GitHub Actions Audit](#14-github-actions-audit)
15. [Security Review](#15-security-review)
16. [Technical Debt Register](#16-technical-debt-register)
17. [Remediation Plan](#17-remediation-plan)
18. [Cost Analysis](#18-cost-analysis)
19. [Scalability Plan](#19-scalability-plan)
20. [MVP vs Enterprise Gap Analysis](#20-mvp-vs-enterprise-gap-analysis)
21. [Prioritised Implementation Roadmap](#21-prioritised-implementation-roadmap)

---

## 1. Repository Audit

### 1.1 Project Identity

| Property | Current (MetricOra MVP) | Target (Fluid Enterprise) |
|---|---|---|
| Brand name | MetricOra | Fluid |
| Positioning | GHG calculator for SMEs | Sustainability intelligence platform |
| Primary audience | Sustainability managers | Enterprise procurement, ESG, sustainability teams |
| Competitive tier | Free/prosumer | BRE SmartWaste, Sphera, Greenly, Emitwise |
| Hierarchy depth | Organisation → Facility | Platform → Tenant → BU → Contract → Project → Site |
| Role count | 6 | 15 |
| White-label | None | Unlimited branded portals |
| Standards | GHG Protocol | GHG Protocol + CSRD + SECR + PPN 06/21 + NHS Evergreen |

### 1.2 Codebase Inventory

| Layer | Files | Est. Lines | Status |
|---|---|---|---|
| App routes (pages) | 46 | ~3,200 | Complete |
| API routes | 82 | ~5,800 | Complete |
| Lib modules | 34 | 3,418 | Complete |
| React components | 29 | ~2,400 | Complete |
| Flutter Dart | 18 + 4 tests | ~2,000 | Complete |
| Workers | 1 entry + 4 handlers | 843 | Complete |
| Prisma schema | 1 | 981 | Complete — 35 models, 17 enums |
| Tests (TS) | 13 | ~800 | Partial — unit only |
| Tests (Dart) | 4 | ~300 | Partial — unit only |
| CI/CD workflows | 4 | ~334 | Complete |
| **Total** | **231** | **~18,745** | |

### 1.3 Technology Stack (Verified)

**Backend / Full-Stack**
- Next.js 16.2.7 (App Router) + React 19.2.4
- TypeScript 5 (strict mode, `bundler` resolution)
- Prisma 6.3.0 ORM → PostgreSQL
- pg-boss 12.18.2 (PostgreSQL-backed job queue — no Redis)
- Better Auth 1.6.17 (kysely 0.28.8 pinned — 0.29.x breaks migration table)
- Zod 3.24.2 (validation at all API boundaries)
- motion 12.40.0 (animations)
- Tailwind CSS 4 + shadcn/ui component library

**Storage & Messaging**
- Cloudflare R2 via `@aws-sdk/client-s3` (S3-compatible; local filesystem fallback)
- Resend 6.12.4 (transactional email; console driver in dev)
- Firebase Admin 13.10.0 (FCM push notifications)
- puppeteer 25.1.0 (Chromium PDF generation)

**Document Processing**
- `xlsx` 0.18.5 — CSV + Excel import templates
- `pdf-parse` 2.4.5 — PDF utility bills / delivery notes
- `mammoth` 1.12.0 — DOCX to plain text

**Flutter Mobile**
- Flutter SDK Dart ≥3.3.0, flutter_riverpod 2.6.1, go_router 14.6.2
- Dio 5.7.0 + flutter_secure_storage 9.2.2 (JWT auth)
- drift 2.20.3 + sqlite3_flutter_libs 0.5.24 (offline SQLite)
- google_mlkit_text_recognition 0.15.0 (on-device OCR — no cloud)
- mobile_scanner 5.2.3, geolocator 13.0.2, fl_chart 0.70.2

**Infrastructure (Zero Docker, Zero Redis)**
- Neon PostgreSQL (free tier — 0.5 GB, 100 compute-hours/month)
- Cloudflare R2 (free tier — 10 GB/month, zero egress)
- Resend free tier (3,000 emails/month)
- Firebase free tier (FCM unlimited push)
- Vercel (frontend hosting — free hobby / Pro)
- Node ≥20 <25, pnpm 10.12.3

### 1.4 Key File Reference Map

| Purpose | File | Lines |
|---|---|---|
| Prisma schema | `prisma/schema.prisma` | 981 |
| Auth config | `lib/auth/index.ts` | 61 |
| Session/RBAC guard | `lib/auth/session.ts` | 74 |
| Calculation engine | `lib/calculation/engine.ts` | 68 |
| Unit registry | `lib/calculation/units.ts` | 54 |
| Factor selector | `lib/calculation/factor-selector.ts` | 67 |
| Calculation runner | `lib/calculation/run-worker.ts` | 219 |
| Import worker | `lib/imports/worker.ts` | 166 |
| Import validator | `lib/imports/validator.ts` | 253 |
| Report worker | `lib/reports/worker.ts` | 250 |
| Report template | `lib/reports/template.ts` | 193 |
| Route/geo distance | `lib/geo/route-distance.ts` | 238 |
| Storage abstraction | `lib/storage/index.ts` | 173 |
| Job dispatch | `lib/jobs/dispatch.ts` | 56 |
| pg-boss init | `lib/jobs/boss.ts` | 24 |
| Audit log | `lib/db/audit.ts` | 65 |
| API error handling | `lib/validation/api.ts` | 41 |
| Org validation schemas | `lib/validation/org.ts` | 276 |
| Security rate limit | `lib/security/rate-limit.ts` | 60 |
| Rate limit (deprecated) | `lib/rate-limit.ts` | 60 |
| Middleware | `middleware.ts` | 72 |
| Next.js config | `next.config.ts` | 50 |
| Factor seed | `prisma/seed.ts` | 312 |
| Workers entry | `workers/index.ts` | 88 |

### 1.5 Open Production-Blocking Decisions

The following five items are recorded in `CLAUDE.md` as unresolved and must be closed before first enterprise contract:

1. **Emission factor licensing** — DEFRA and EPA redistribution terms for production use
2. **Methodology versioning policy** — when `ghg-protocol-v2026-01` increments and how tenants are notified
3. **Billing model** — org gating, trials, seat limits; will require schema additions (Plan, Subscription models)
4. **Primary report format** — auditor package vs customer disclosure vs executive summary; three templates exist in code but page count and branding differ per standard
5. **Currency exchange rates** — spend-based Scope 3 in `lib/calculation/units.ts:29-41` uses fixed approximations; live rates required for ISO 14064 audit pass

---

## 2. Data Flow Map

### 2.1 Web Platform — Data Ingress Paths

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA INGRESS (Web)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [CSV / Excel upload]                                           │
│       │                                                         │
│       ▼                                                         │
│  POST /api/orgs/[orgId]/imports                                 │
│       │  Zod validation + org check                            │
│       │  R2 upload (org/{orgId}/imports/{id}/source.csv)       │
│       │  Checksum dedup (ImportBatch.sourceChecksum)           │
│       ▼                                                         │
│  pg-boss: imports queue                                         │
│       │                                                         │
│       ▼                                                         │
│  lib/imports/worker.ts                                          │
│   ├── parser.ts → xlsx/pdf-parse/mammoth                       │
│   ├── validator.ts → 40 field aliases, type checks             │
│   ├── StagedActivityRecord rows (importBatchId)                │
│   └── ImportBatch.state machine:                               │
│       uploaded → parsing → validating →                        │
│       needs_attention | ready_to_commit                        │
│       └──▶ POST /imports/[id]/commit                          │
│               └──▶ ActivityRecord rows (committed)             │
│                                                                 │
│  [Manual record entry]                                          │
│       │                                                         │
│       ▼                                                         │
│  POST /api/orgs/[orgId]/records                                 │
│       │  Zod schema (lib/validation/records.ts)               │
│       └──▶ ActivityRecord (reviewStatus: draft)                │
│                                                                 │
│  [Emission factor import]                                       │
│       │                                                         │
│       ▼                                                         │
│  POST /api/orgs/[orgId]/factors/import                         │
│       │  Admin-only (requireOrgMember: admin)                  │
│       └──▶ FactorLibrary + EmissionFactor rows                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile App — Field Capture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   DATA INGRESS (Flutter)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Field worker opens app]                                       │
│       │                                                         │
│       ▼                                                         │
│  InviteLink deep link → PIN setup (flutter_secure_storage)     │
│       │                                                         │
│       ▼                                                         │
│  [Camera captures document]                                     │
│       │                                                         │
│       ▼                                                         │
│  google_mlkit_text_recognition (on-device, offline capable)    │
│       │                                                         │
│       ▼                                                         │
│  ocr_extractor.dart → regex + heuristics extract:             │
│       ├── Waste ticket: weight, EWC code, date, vehicle reg   │
│       ├── Delivery note: material, quantity, supplier, date   │
│       └── Fuel receipt: fuel type, volume, vehicle reg, date  │
│                                                                 │
│       ▼                                                         │
│  Pre-filled submission form → user reviews/corrects            │
│       │                                                         │
│       ▼                                                         │
│  Saved to drift/SQLite (offline-first)                         │
│       │                                                         │
│       ▼                                                         │
│  Background sync (connectivity_plus → sync_service.dart)      │
│       │  Photo → R2 presigned upload                          │
│       ▼                                                         │
│  POST /api/orgs/[orgId]/field-submissions                      │
│       │  JWT bearer token (Dio interceptor)                   │
│       │  Idempotency key (prevents duplicate syncs)           │
│       └──▶ FieldSubmission (status: submitted)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Calculation & Reporting Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│              CALCULATION → REPORTING PIPELINE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ActivityRecord rows (approved, committed)                      │
│       │                                                         │
│       ▼                                                         │
│  POST /api/orgs/[orgId]/calculation-runs                       │
│       │  triggerHash dedup check                              │
│       └──▶ pg-boss: calculations queue                        │
│                                                                 │
│       ▼                                                         │
│  lib/calculation/run-worker.ts (processCalculationRun)         │
│   ├── 1. Fetch ActivityRecord rows for org + period            │
│   ├── 2. units.ts → normalizeUnit() (kg, kWh, km, litre, GBP) │
│   ├── 3. factor-selector.ts → selectFactor()                  │
│   │       category + scope + geography + date + scope2method  │
│   ├── 4. engine.ts → computeCo2e()                           │
│   │       gas-specific: CO2 + CH4×27.9 + N2O×273            │
│   │       scalar: amount × co2e factor                        │
│   │       stores: formula string, warnings JSON               │
│   ├── 5. Persist EmissionCalculation (immutable, append-only) │
│   └── 6. Rebuild DashboardAggregate rows                      │
│                                                                 │
│       ▼                                                         │
│  POST /api/orgs/[orgId]/calculation-runs/[runId]/             │
│       publish-snapshot                                          │
│       └──▶ PublishedSnapshot (immutable)                      │
│                                                                 │
│       ▼                                                         │
│  POST /api/orgs/[orgId]/reports                                │
│       └──▶ pg-boss: reports queue                             │
│                                                                 │
│       ▼                                                         │
│  lib/reports/worker.ts (processReport)                         │
│   ├── Fetch snapshot + DashboardAggregate + factors            │
│   ├── lib/reports/template.ts → HTML (summary, scope, trends) │
│   ├── Puppeteer → PDF (headless Chromium)                     │
│   ├── R2 upload: org/{orgId}/reports/{id}/report.pdf          │
│   └── SHA-256 checksum stored on Report row                   │
│                                                                 │
│       ▼                                                         │
│  GET /api/orgs/[orgId]/reports/[reportId]/download            │
│       └──▶ 15-min presigned R2 URL returned to client        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Review & Approval Flow

```
FieldSubmission (submitted)
    │
    ▼
POST /field-submissions/[id]/review
    │
    ├── approved → ActivityRecord (reviewStatus: approved)
    │              + AuditLog entry
    │
    ├── rejected → FieldSubmission (status: rejected)
    │              + reviewNote set
    │              + mobile app notified via FCM
    │
    └── needs_info → FieldSubmission (status: needs_info)
                     + Comment thread opened
                     + FCM push to field worker
```

---

## 3. Architecture Diagram

### 3.1 Current Architecture (MetricOra MVP)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          INTERNET                                        │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
              ┌─────────────────┴──────────────────┐
              │          Vercel Edge Network        │
              │        (CDN + Routing Layer)        │
              └─────────────────┬──────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────────┐
│                         Next.js 16 (App Router)                          │
│              ┌──────────────────────────────────────────┐                │
│              │              middleware.ts                │                │
│              │  • Rate limiting (per IP)                │                │
│              │  • Security headers (HSTS, X-Frame, CSP) │                │
│              └──────────────┬───────────────────────────┘                │
│                             │                                            │
│         ┌───────────────────┼──────────────────────┐                    │
│         ▼                   ▼                       ▼                    │
│  ┌─────────────┐   ┌────────────────┐   ┌─────────────────────┐         │
│  │  Marketing  │   │  Auth Pages    │   │  App Shell (auth'd) │         │
│  │  (marketing)│   │  (auth)/       │   │  (app)/orgs/[orgId] │         │
│  └─────────────┘   └────────────────┘   └─────────────────────┘         │
│                                                   │                      │
│              ┌────────────────────────────────────▼──────────────────┐   │
│              │              API Routes (82 total)                     │   │
│              │  /api/auth/  /api/orgs/[orgId]/{records,imports,...}  │   │
│              └──────────┬─────────────────────────────────────────────┘  │
│                         │                                                │
│         ┌───────────────┴───────────────┐                               │
│         ▼                               ▼                               │
│  ┌─────────────┐               ┌─────────────────┐                      │
│  │ Better Auth │               │   Prisma ORM    │                      │
│  │ (sessions + │               │  (PostgreSQL)   │                      │
│  │    JWT)     │               └────────┬────────┘                      │
│  └─────────────┘                        │                               │
│                                         │                               │
└─────────────────────────────────────────┼────────────────────────────────┘
                                          │
              ┌───────────────────────────┼────────────────────────────┐
              │                           │                            │
              ▼                           ▼                            ▼
    ┌─────────────────┐       ┌──────────────────┐       ┌────────────────────┐
    │   Neon Postgres  │       │  Cloudflare R2   │       │  Workers Process   │
    │  (app data +    │       │  (evidence, PDF, │       │  (pg-boss, tsx)    │
    │   pg-boss queue)│       │   imports)       │       │  imports / calcs / │
    └─────────────────┘       └──────────────────┘       │  reports / notify  │
                                                         └────────────────────┘
                                                                  │
              ┌───────────────────────────────────────────────────┤
              ▼                           ▼                        ▼
    ┌─────────────────┐       ┌──────────────────┐    ┌───────────────────────┐
    │     Resend      │       │  Firebase FCM    │    │  Puppeteer (Chromium) │
    │  (email: tasks, │       │  (mobile push)   │    │  (PDF generation)     │
    │   invites)      │       └──────────────────┘    └───────────────────────┘
    └─────────────────┘

              ┌───────────────────────────────────────────────────┐
              │              Flutter Mobile App                    │
              │  Riverpod state • go_router • Dio (JWT)           │
              │  drift/SQLite (offline) • ML Kit OCR              │
              │  connectivity_plus • geolocator • share_plus      │
              └───────────────────────────────────────────────────┘
```

### 3.2 Target Architecture (Fluid Enterprise)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    FLUID ENTERPRISE PLATFORM                             │
│                                                                          │
│  Platform Admin Portal          Tenant White-Label Portals               │
│  (platform-owner access)        (tenant-branded subdomains)              │
│         │                               │                               │
│         └───────────────┬───────────────┘                               │
│                         ▼                                               │
│              ┌─────────────────────┐                                    │
│              │  Next.js 16 (mono)  │                                    │
│              │  Multi-tenant aware │                                    │
│              │  White-label theming│                                    │
│              └──────┬──────────────┘                                    │
│                     │                                                   │
│         ┌───────────┼────────────────┐                                  │
│         ▼           ▼                ▼                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐                        │
│  │ Platform │ │ Tenant   │ │  Field Capture   │                        │
│  │ Admin UI │ │  App UI  │ │  (Flutter)       │                        │
│  └──────────┘ └──────────┘ └──────────────────┘                        │
│                                                                          │
│              ┌────────────────────────────────────┐                     │
│              │        API Layer (Next.js)          │                     │
│              │  /api/platform/tenants              │                     │
│              │  /api/tenants/[t]/contracts/[c]/    │                     │
│              │       projects/[p]/sites/[s]/records│                     │
│              │  /api/tenants/[t]/social-value      │                     │
│              │  /api/tenants/[t]/waste-classifier  │                     │
│              └───────────┬────────────────────────┘                     │
│                          │                                              │
│         ┌────────────────┼──────────────┐                               │
│         ▼                ▼              ▼                               │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐                        │
│  │  PostgreSQL  │ │ PostGIS  │ │  R2 (multi-  │                        │
│  │  (Neon)     │ │ extension│ │  tenant keys)│                        │
│  └──────────────┘ └──────────┘ └──────────────┘                        │
│                                                                          │
│         AI/OCR Pipeline         Social Value Engine                     │
│  ┌───────────────────────┐  ┌────────────────────────────┐              │
│  │ Claude (Anthropic API)│  │ National TOMS calc engine  │              │
│  │ + ML Kit (on-device)  │  │ + TOMS framework weighting │              │
│  │ → waste classification│  │ + social value £ output    │              │
│  │ → EWC code suggestion │  └────────────────────────────┘              │
│  └───────────────────────┘                                              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema Review

### 4.1 Model Inventory (35 models — all confirmed in `prisma/schema.prisma`)

| Model | Purpose | Lines (approx) | Status |
|---|---|---|---|
| User | Identity | 20 | Complete |
| Session | Better Auth session | 12 | Complete |
| Account | OAuth/email provider | 15 | Complete |
| Verification | Email verify tokens | 8 | Complete |
| Organization | Tenant root | 22 | **Needs hierarchy fields** |
| OrganizationMembership | RBAC join | 14 | **Needs 9 new roles** |
| Facility | Physical site | 12 | Complete |
| BusinessUnit | Org division | 10 | Complete |
| ReportingPeriod | Time scope | 16 | Complete |
| EmissionCategory | GHG taxonomy | 12 | **Needs 12 more categories** |
| ActivityRecord | Committed activity | 45 | Complete |
| ActivityRecordEvidence | Join table | 8 | Complete |
| ImportBatchEvidence | Join table | 8 | Complete |
| EvidenceFile | File ref | 14 | Complete |
| ImportBatch | CSV upload | 24 | Complete |
| StagedActivityRecord | Pre-commit staging | 12 | Complete |
| EmissionFactor | GHG coefficient | 20 | Complete |
| FactorLibrary | Factor source | 10 | Complete |
| MethodologyVersion | Calc framework | 8 | Complete |
| EmissionCalculation | Immutable output | 22 | Complete |
| CalculationRun | Pipeline exec | 16 | Complete |
| PublishedSnapshot | Locked result | 12 | Complete |
| DashboardAggregate | Pre-computed totals | 16 | Complete |
| Report | Generated output | 18 | Complete |
| ReviewTask | Work item (polymorphic) | 14 | Complete |
| Comment | Discussion thread | 12 | Complete |
| AuditLog | Compliance log | 12 | Complete |
| InviteLink | Field worker invite | 14 | Complete |
| FieldSubmission | Mobile intake | 30 | Complete |
| FieldSubmissionFile | Join table | 8 | Complete |
| FieldWorkerAssignment | Period allocation | 12 | Complete |
| RouteDistance | Road distance cache | 16 | Complete |
| PostcodeGeocode | Geocode cache | 12 | Complete |
| ReductionTarget | Baseline→target | 14 | Complete |
| ReductionInitiative | Decarbonisation project | 16 | Complete |

### 4.2 Schema Strengths

- **Multi-tenancy**: every table includes `organizationId`; Prisma enforces FK to Organization
- **Immutability**: `EmissionCalculation` is append-only; `PublishedSnapshot` never mutated
- **Audit traceability**: `AuditLog` has no `updatedAt`; `writeAuditLog()` is the only write path
- **Idempotency**: `ImportBatch.sourceChecksum`, `CalculationRun.triggerHash`, `Report.requestHash`, `FieldSubmission.idempotencyKey` all prevent duplicate work
- **Factor denormalization**: `EmissionCalculation` stores `factorLibraryVersion` and `methodologyVersionName` as strings — survives future version changes without join corruption
- **Offline safety**: `FieldSubmission` has `deviceSubmittedAt` and `idempotencyKey` supporting reliable mobile sync

### 4.3 Schema Gaps (Enterprise Transformation Required)

#### GAP 1: No platform-level hierarchy
Current schema has `Organization` as the root. Enterprise Fluid requires:

```
Platform (Fluid itself)
  └── Tenant (e.g., "Balfour Beatty")
        └── BusinessUnit (e.g., "Infrastructure Division")
              └── Contract (e.g., "HS2 Lot 1 - Enabling Works")
                    └── Project (e.g., "Euston Station - Groundworks")
                          └── Site (e.g., "Excavation Zone A")
```

Missing models: `Platform`, `Tenant`, `Contract`, `Project`, `Site`

#### GAP 2: No white-label branding model
No `TenantBranding` or `WhiteLabelPortal` model exists.

Missing fields on `Organization` (or new `TenantBranding` table):
- `subdomain` — for `[tenant].fluidplatform.com`
- `primaryColor`, `accentColor`
- `logoStorageKey`
- `customEmailFromDomain`
- `faviconStorageKey`
- `reportHeaderLogoKey`

#### GAP 3: No Social Value models
National TOMS (Themes, Outcomes, Measures) engine is entirely absent:

Missing models: `SocialValueTheme`, `SocialValueMeasure`, `SocialValueRecord`, `SocialValueTarget`, `NationalTomsWeight`

#### GAP 4: No Contract-level reporting scope
Reports currently tie to `ReportingPeriod` at org level. Enterprise needs:
- Report scoped to a single Contract (PPN 06/21 compliance)
- Report scoped to a Project (client-deliverable granularity)
- Social value and carbon bundled in a single contractor submission

#### GAP 5: No billing/subscription model
Missing: `Plan`, `Subscription`, `UsageRecord`, `Invoice` — required for SaaS gating

#### GAP 6: PostGIS not enabled
`PostcodeGeocode` stores `latitude`/`longitude` as Float. No `geography` or `geometry` columns. PostGIS spatial indexes and `ST_Distance` queries are not available. Required for:
- Facility catchment matching
- Site-to-facility distance (construction zone → disposal facility)
- Heat maps in the dashboard

#### GAP 7: CSRD / SECR / NHS Evergreen reporting metadata
No model tracks which regulatory frameworks a tenant reports against, which periods are in scope, or what the submission deadlines are. Required for automated compliance calendar features.

### 4.4 Index Review

**Confirmed present (from schema):**
- `ActivityRecord`: composite on `(organizationId, reportingPeriodId, emissionCategoryId, facilityId, reviewStatus, createdAt)` — critical for dashboard queries
- `ImportBatch`: `(organizationId, reportingPeriodId, state)` and `(organizationId, sourceChecksum)`
- `FieldSubmission`: `(organizationId, status, createdAt)` and `(organizationId, submittedByUserId)`
- `DashboardAggregate`: `(organizationId, reportingPeriodId, snapshotId)`
- `AuditLog`: `(organizationId, resourceType, resourceId)` and `(organizationId, createdAt)`

**Missing for enterprise scale:**
- `ActivityRecord` needs `(organizationId, activityDate)` for time-range queries
- `FieldSubmission` needs `(organizationId, facilityId, createdAt)` for site-level queries
- `EmissionFactor` needs `(factorLibraryId, emissionCategoryId, effectiveStartDate)` composite
- `RouteDistance` needs GiST index on geography columns once PostGIS is added

---

## 5. API Review

### 5.1 API Surface (82 route files)

| Domain | Count | Auth | Paginated |
|---|---|---|---|
| Auth (Better Auth passthrough) | 2 | Public / Better Auth | No |
| Organisation CRUD | 3 | requireOrgMember | No |
| Member management | 2 | admin | No |
| Invite links | 2 | admin | No |
| Reporting periods | 2 | editor | No |
| Facilities | 2 | editor | No |
| Business units | 2 | editor | No |
| Activity records | 8 | editor / reviewer | Yes (cursor) |
| Imports | 7 | editor | Yes (cursor) |
| Field submissions | 5 | field_worker / reviewer | Yes (cursor) |
| Field worker assignments | 2 | admin | No |
| Calculation runs | 3 | editor | No |
| Reports | 3 | viewer / auditor | No |
| Evidence (files) | 3 | editor | No |
| Review tasks | 2 | reviewer | No |
| Comments | 1 | any member | No |
| Targets | 2 | editor | No |
| Initiatives | 2 | editor | No |
| Dashboard (snapshots) | 1 | viewer | No |
| Route distance | 1 | editor | No |
| Factor import | 1 | admin | No |
| Health check | 1 | Public | No |
| Dev storage | 2 | Dev only | No |
| **Total** | **82** | | |

### 5.2 API Design Patterns (Verified)

- **Error format** (all routes): `{ code: string, message: string, details?: unknown }` via `apiError()` in `lib/validation/api.ts:1-41`
- **Auth guard**: `requireSession()` + `requireOrgMember(orgId, ...roles)` in `lib/auth/session.ts:1-74`
- **Input validation**: Zod schema at API boundary before any DB access
- **Idempotency**: business-key dedup on imports, calculations, reports, field submissions
- **Cursor pagination**: `after` + `limit` on list endpoints (ImportBatch, ActivityRecord)
- **Presigned URLs**: 15-min TTL R2 URLs; never expose raw storage keys to clients
- **Audit logging**: `writeAuditLog()` called after every state-mutating operation

### 5.3 API Gaps (Enterprise)

#### Missing endpoints:
- `GET /api/platform/tenants` — platform owner tenant list
- `GET /api/tenants/[tenantId]/contracts` — contract list
- `POST /api/tenants/[tenantId]/contracts/[contractId]/projects` — project creation
- `GET /api/tenants/[tenantId]/social-value` — TOMS aggregates
- `POST /api/tenants/[tenantId]/waste-classifier` — AI waste classification
- `GET /api/tenants/[tenantId]/reports/csrd` — CSRD-structured report
- `GET /api/tenants/[tenantId]/reports/secr` — SECR submission export
- `POST /api/platform/tenants/[tenantId]/branding` — white-label config

#### Duplicate route concern:
`/api/orgs/[orgId]/records/` and `/api/orgs/[orgId]/activity-records/` are parallel routes serving the same resource. One is a deprecation candidate (technical debt item TD-003).

#### No OpenAPI / Swagger schema:
82 routes with no machine-readable API spec. Blocks: external integrations, SAP/Power BI connectors, auto-generated SDK clients.

---

## 6. Multi-Tenant Review

### 6.1 Current Multi-Tenancy Architecture

**Pattern:** Single-level. `Organization` is the tenant root. Every table has `organizationId` FK.

**Enforcement mechanism:** `lib/auth/session.ts → requireOrgMember(orgId, ...roles)` — called at the start of every org-scoped API route handler. Raises `AuthError` if the session user is not a member of the requested org.

**Verified in code:**
```typescript
// lib/auth/session.ts:45-74
export async function requireOrgMember(
  orgId: string,
  ...allowedRoles: OrgRole[]
): Promise<{ session: Session; membership: OrganizationMembership }> {
  const session = await requireSession();
  const membership = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: session.user.id } },
  });
  if (!membership) throw new AuthError("Not a member of this organization");
  if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role))
    throw new AuthError("Insufficient role");
  return { session, membership };
}
```

**Cross-tenant protection:** Prisma queries always include `where: { organizationId: orgId }` after the `requireOrgMember` check. This provides defence-in-depth beyond the session check.

### 6.2 Multi-Tenancy Strengths

- All 35 models consistently include `organizationId`
- Session check + DB filter = two-layer isolation
- `AuditLog` records `organizationId` on every event — cross-tenant anomaly detection is possible
- `FieldSubmission.idempotencyKey` scoped to `(organizationId, submittedByUserId)` — prevents cross-org collision

### 6.3 Multi-Tenancy Gaps

#### GAP MT-1: No platform-level super-admin access
There is no mechanism for a Fluid platform owner to access all tenants, manage billing, or perform emergency operations. The `admin` role is org-scoped only.

**Required:** A `PlatformMembership` model with roles `platform_owner`, `platform_support`, `platform_analyst`.

#### GAP MT-2: No tenant isolation testing
The `CLAUDE.md` notes cross-tenant access as a P0 security bug but no automated regression tests verify it. No test file contains `cross-tenant` or `organization isolation` test cases.

#### GAP MT-3: Hierarchy is flat
Enterprise contracts (e.g., PPN 06/21) require reporting by Contract number, Project ID, and Site. The current flat `Organization → Facility` structure cannot represent:
- A single contractor (`Tenant`) working on multiple client contracts
- A project with sub-sites that each have their own emission records
- Aggregation of carbon data rolled up from Site → Project → Contract → Tenant

#### GAP MT-4: No data residency controls
No mechanism to pin a tenant's data to a specific Neon region or R2 datacenter. Required for tenants with data sovereignty requirements (NHS, MOD procurement).

---

## 7. White-Label Review

### 7.1 Current State

**Result: Zero white-label capability.** The current codebase has no branding abstraction, no subdomain routing, no theming system, and no per-tenant visual configuration.

All pages render with:
- Hardcoded brand name "MetricOra" in `android/app/src/main/AndroidManifest.xml:11`
- Hardcoded Tailwind CSS colour palette (no CSS custom property overrides)
- No `subdomain` or `customDomain` field on `Organization`
- No logo or favicon upload endpoint
- No report header branding
- No email `from` domain per tenant

### 7.2 Required Architecture for White-Label

#### 7.2.1 Subdomain Routing

Next.js middleware must read the `Host` header and resolve the tenant:

```typescript
// middleware.ts (new section)
const hostname = request.headers.get("host");
const subdomain = hostname?.split(".")[0]; // "balfour" from "balfour.fluidplatform.com"
const tenant = await db.organization.findUnique({ where: { subdomain } });
```

Vercel supports wildcard domains (`*.fluidplatform.com`) via project settings.

#### 7.2.2 Theme Injection

A `TenantBranding` Prisma model should store:
- `primaryHex`, `accentHex` — injected as CSS custom properties in `<head>`
- `logoStorageKey` — presigned URL served via `/api/brand/logo`
- `faviconStorageKey`
- `reportHeaderLogoKey` — used by Puppeteer when generating PDFs

CSS custom properties injected server-side per request:

```html
<style>
  :root {
    --brand-primary: #0f4c8a;
    --brand-accent: #e8f0fe;
  }
</style>
```

Tailwind CSS 4 supports `@theme` directive with runtime overrides.

#### 7.2.3 Email Branding

Resend supports per-sender `from` domains. Tenant config needs:
- `emailFromDomain` — e.g., `notifications@balfourbeattysustainability.com`
- `emailFromName` — e.g., `Balfour Beatty Sustainability`

#### 7.2.4 Report Branding

`lib/reports/template.ts` currently renders a generic HTML header. Needs:
- Tenant logo in top-left (fetched from R2 at report generation time)
- Tenant primary colour for table headers and section backgrounds
- Tenant name as the report issuer

### 7.3 White-Label Complexity Estimate

| Component | Effort | Complexity |
|---|---|---|
| Subdomain routing (middleware) | 1 day | Low |
| TenantBranding Prisma model | 0.5 day | Low |
| CSS custom property injection | 1 day | Low |
| Logo upload endpoint | 1 day | Low |
| Email from-domain per tenant | 0.5 day | Low |
| Puppeteer report branding | 2 days | Medium |
| Flutter app white-label build | 3 days | High |
| iOS/Android App Store per-tenant | 5 days | High |
| **Total** | **~14 days** | |

---

## 8. RBAC Matrix

### 8.1 Current RBAC (6 roles)

Defined in `prisma/schema.prisma` as enum `OrgRole`:

| Role | Description |
|---|---|
| `admin` | Full org control: settings, members, invite links, all data |
| `editor` | Create/edit records, trigger imports, run calculations |
| `reviewer` | Approve/reject records and field submissions |
| `viewer` | Read-only access to dashboard, records, reports |
| `auditor` | Read-only + download reports; cannot modify anything |
| `field_worker` | Submit field submissions only; no org data visibility |

Enforcement in `lib/auth/session.ts:45-74`.

### 8.2 Target RBAC Matrix (Fluid Enterprise — 15 roles)

| Role | Scope | Key Permissions |
|---|---|---|
| **Platform Owner** | Platform | All tenants CRUD, billing, white-label config, platform analytics |
| **Platform Support** | Platform | Read all tenants, impersonate org admin (with audit trail) |
| **Platform Analyst** | Platform | Read-only aggregated platform metrics, no PII |
| **Tenant Admin** | Tenant | Full tenant control: users, contracts, branding, API keys |
| **Tenant Editor** | Tenant | Create contracts/projects, run calculations, manage factors |
| **Tenant Reviewer** | Tenant | Approve records, field submissions, report sign-off |
| **Tenant Viewer** | Tenant | Read-only dashboard, records, reports |
| **Tenant Auditor** | Tenant | Read-only + export; timestamped read-access log |
| **Contract Manager** | Contract | Manage their contract's projects and sites; invite subcontractors |
| **Project Manager** | Project | Manage one project's sites and records |
| **Site Manager** | Site | Manage one site's records; cannot see other sites |
| **Subcontractor Admin** | Contract (external) | Submit on behalf of their company; view own submissions |
| **Field Worker** | Assigned sites | Submit field capture; view own submission status |
| **Client Viewer** | Contract (external) | Read-only access to a contract's carbon/social report; no data |
| **Reporting Analyst** | Tenant | Build custom reports; no edit permissions |

### 8.3 Permission Grid

| Action | Platform Owner | Tenant Admin | Contract Manager | Project Manager | Field Worker | Client Viewer |
|---|---|---|---|---|---|---|
| Create tenant | ✓ | — | — | — | — | — |
| Configure branding | ✓ | ✓ | — | — | — | — |
| Invite users | ✓ | ✓ | ✓ (to contract) | — | — | — |
| Create contract | — | ✓ | — | — | — | — |
| Create project | — | ✓ | ✓ | — | — | — |
| Create site | — | ✓ | ✓ | ✓ | — | — |
| Submit evidence | — | ✓ | ✓ | ✓ | ✓ | — |
| Approve records | — | ✓ | ✓ | — | — | — |
| Run calculations | — | ✓ | ✓ | — | — | — |
| Publish snapshot | — | ✓ | — | — | — | — |
| Generate report | — | ✓ | ✓ | — | — | — |
| View report | — | ✓ | ✓ | ✓ | — | ✓ |
| Download audit log | ✓ | ✓ | — | — | — | — |
| Manage billing | ✓ | — | — | — | — | — |
| View platform metrics | ✓ | — | — | — | — | — |

### 8.4 RBAC Migration Path

1. Add new roles to `OrgRole` enum in schema (non-breaking — Postgres enum can `ADD VALUE`)
2. Add `PlatformMembership` model with `PlatformRole` enum
3. Extend `requireOrgMember()` to accept hierarchy-scoped roles (contract, project, site)
4. Add `requirePlatformMember()` helper for platform-level routes
5. Update all route handlers to use correct role sets

---

## 9. OCR Architecture

### 9.1 Current OCR (Flutter Mobile Only)

**Package:** `google_mlkit_text_recognition 0.15.0` — on-device, free, offline, iOS + Android

**Implementation:** `mobile/lib/features/capture/ocr_extractor.dart`

**Pipeline:**
1. User photographs document (camera.dart or image_picker)
2. ML Kit runs on-device text recognition (~1–2 seconds offline)
3. `ocr_extractor.dart` applies regex + heuristics per document type:
   - **Waste ticket**: weight (kg/tonnes), EWC code (e.g., `17 05 04`), date, vehicle registration, site address
   - **Delivery note**: material type, quantity + unit, delivery address, supplier name, date
   - **Fuel receipt**: fuel type, volume (litres), vehicle reg, date, total cost
4. Extracted fields pre-fill the submission form
5. User reviews and corrects; unrecognised fields left blank

**Test coverage:** `mobile/test/capture/ocr_extractor_test.dart` — deterministic unit tests with static PNG fixtures (no camera required)

### 9.2 OCR Strengths

- Zero cloud API cost — fully on-device
- Works offline (construction site poor connectivity)
- Deterministic and unit-testable independent of camera hardware
- Supports Android and iOS via the same Dart package

### 9.3 OCR Gaps (Enterprise)

#### GAP OCR-1: No web-side OCR
When a sustainability manager uploads a PDF delivery note or scanned waste manifest via the web import interface, there is no OCR extraction — only raw CSV/Excel parsing (`lib/imports/parser.ts`). The mobile app is the only OCR entry point.

**Required:** Web-side OCR pipeline for document uploads:
- `pdf-parse` already parses text from PDFs — needs an extraction layer on top
- For scanned/image PDFs: integrate `claude-sonnet-4-6` vision API for structured extraction
- Output: populate `StagedActivityRecord.data` with pre-extracted fields

#### GAP OCR-2: No AI waste classification
EWC code classification from text is purely regex. When the OCR output is ambiguous (e.g., "concrete rubble, reinforced, mixed") no ML model suggests the most likely EWC code.

**Required:** A classification endpoint using Claude:
- Input: raw OCR text + document type
- Output: `{ ewcCode: string, confidence: number, reasoning: string }`
- This can also suggest the correct Scope 3 emission category from raw text

#### GAP OCR-3: No OCR quality feedback loop
Extracted fields are submitted without feedback to improve extraction. There is no mechanism to flag incorrect extractions for model improvement.

#### GAP OCR-4: No barcode/QR integration on web
`mobile_scanner` handles QR codes on the Flutter app. Web has no equivalent for waste manifests with QR codes.

### 9.4 Target OCR Architecture (Fluid)

```
Mobile (on-device)             Web (cloud)
──────────────────             ────────────
ML Kit (free, offline)  │      Uploaded PDF/scan
        │               │             │
        ▼               │             ▼
ocr_extractor.dart      │      pdf-parse (text extraction)
  (regex + heuristic)   │      + Puppeteer (image render for scanned PDFs)
        │               │             │
        ▼               │             ▼
 FieldSubmission        │      POST /api/orgs/[id]/imports/[id]/extract-ocr
  pre-filled form       │             │
                        │             ▼
                        │      Claude API (vision)
                        │      Structured extraction + EWC suggestion
                        │             │
                        │             ▼
                        │      StagedActivityRecord.data (pre-filled)
```

---

## 10. DEFRA Carbon Engine Review

### 10.1 Current Engine (Verified in Source)

**Core files:**
- `lib/calculation/units.ts` (54 lines) — canonical unit registry
- `lib/calculation/engine.ts` (68 lines) — CO2e computation
- `lib/calculation/factor-selector.ts` (67 lines) — factor selection
- `lib/calculation/run-worker.ts` (219 lines) — full pipeline orchestration

**Factor libraries seeded (`prisma/seed.ts:312 lines`):**
- DEFRA 2025.1 (UK gov conversion factors)
- EPA 2025.1 (US GHG Emission Factors Hub)
- 38 factors total covering:
  - Scope 1: natural gas, burning oil, LPG, diesel, petrol, R-410A, R-134a, R-32
  - Scope 2: UK electricity (location-based + market-based), US electricity
  - Scope 3: car/rail/flight business travel, commute modes, HGV/van freight, EEIO spend-based

**GWP values (AR6):** CH4 = 27.9, N2O = 273 (hardcoded in `engine.ts`)

**Methodology:** `ghg-protocol-v2026-01` (seeded in `MethodologyVersion`)

**Factor selector logic (`factor-selector.ts`):**
- Scores factors by: category match, geography (`geographyCountry`), activity type, date range coverage
- Logs selection reason to `EmissionCalculation.warnings`
- Deterministic — same inputs always produce same factor

**Calculation formula (engine.ts):**
```typescript
// Gas-specific (Scope 1 combustion):
totalCo2e = amount × (co2 + ch4 × 27.9 + n2o × 273)

// Scalar (pre-computed co2e factor):
totalCo2e = amount × factor.co2e

// Formula string stored:
"amount_normalised × (co2_factor + ch4_factor × 27.9 + n2o_factor × 273)"
```

### 10.2 Engine Strengths

- Immutable `EmissionCalculation` rows — recalculation never overwrites historical data
- Formula string stored per calculation — full audit trail
- `factorLibraryVersion` and `methodologyVersionName` denormalized — survives library upgrades
- `DashboardAggregate` materialises totals — dashboard never re-aggregates live rows
- Unit normalisation (`normalizeUnit()`) converts all inputs to canonical units before factor matching

### 10.3 Engine Gaps (Enterprise)

#### GAP CALC-1: Only 38 emission factors seeded
DEFRA 2025 contains thousands of factors. The seed covers 9 MVP categories with limited geography depth. Missing:
- Full construction materials category (concrete, steel, timber, insulation, glass)
- Waste treatment factors (landfill, incineration, composting, anaerobic digestion)
- Water supply and wastewater treatment
- All 35 UK waste categories (EWC chapter codes)
- Refrigerant leakage for full R-series (R-22, R-407C, R-507A, R-744)
- UK grid intensity by region (National Grid ESO data)
- Freight modes: sea freight, air freight, intermodal

#### GAP CALC-2: No transport distance→CO2e calculation
`lib/geo/route-distance.ts` calculates road distance (km) via OSRM + postcodes.io. But the engine does not automatically chain:
`pickup postcode + delivery postcode → km → HGV emission factor → CO2e`

The `ActivityRecord` has `routeDistanceId` but `run-worker.ts` does not automatically use it when an activity record has postcodes but no explicit distance.

#### GAP CALC-3: No spend-based fallback logic
When a quantity-based factor is unavailable, DEFRA recommends spend-based EEIO factors. The factor selector does not implement this fallback — it will simply fail to match, leaving the record uncalculated.

#### GAP CALC-4: No Scope 2 market-based supplier matching
The `scope2Method` field exists on `ActivityRecord` and `EmissionFactor` but there is no mechanism to match a supplier-specific renewable energy certificate (REDOff/REGO) to reduce a record's Scope 2 mb factor below the grid average.

#### GAP CALC-5: OSRM uses public instance
`OSRM_BASE_URL` defaults to `https://router.project-osrm.org` — a public, rate-limited, unreliable API. Production requires either:
- Self-hosted OSRM with UK road network data, or
- Commercial routing API (HERE, Google Maps Routes API)

#### GAP CALC-6: No waste-specific factors
The construction and waste haulage verticals (the primary commercial targets) require EWC-code-level waste treatment factors. None are currently seeded.

### 10.4 Required Expansion

| Factor Category | Source | Priority |
|---|---|---|
| Construction materials (26 material types) | DEFRA 2025 + ICE Database v3 | P0 |
| Waste treatment by EWC chapter | DEFRA 2025 Appendix 10 | P0 |
| Freight: sea, air, rail, HGV by load factor | DEFRA 2025 | P0 |
| UK regional grid intensity | National Grid ESO | P1 |
| Full refrigerant series | DEFRA 2025 | P1 |
| Water supply and wastewater | DEFRA 2025 | P1 |
| Spend-based EEIO (full industry codes) | EPA USEEIO v2.0 | P2 |

---

## 11. Social Value Engine Review

### 11.1 Current State

**Result: Not implemented.** The schema has no Social Value models. No API routes exist. No calculation logic is present. No UI components render social value data.

The `ReductionInitiative` model (`expectedImpactCo2e`, `costAmount`) provides a rudimentary place to record planned initiatives, but this is not a Social Value measurement engine.

### 11.2 What the Social Value Engine Needs to Do

National TOMS (Themes, Outcomes, Measures) is the standard framework used in UK public sector procurement (PPN 06/21, NHS, local authorities). It quantifies social value in financial terms (£) from activities such as:
- Employing local workers
- Apprenticeship placements
- Supply chain spend with SMEs
- Volunteering hours
- Environmental improvements beyond compliance

### 11.3 Required Data Model

```prisma
model SocialValueTheme {
  id       String @id @default(cuid())
  code     String @unique   // e.g., "T1" (Jobs & Skills)
  name     String
  measures SocialValueMeasure[]
}

model SocialValueMeasure {
  id            String @id @default(cuid())
  themeId       String
  theme         SocialValueTheme @relation(...)
  tomsCode      String @unique  // e.g., "T1/M1"
  name          String          // "Local employment (FTE)"
  unit          String          // "FTE", "hours", "£"
  valuePerUnit  Decimal         // £ per unit (National TOMS 2025)
  notes         String?
  records       SocialValueRecord[]
}

model SocialValueRecord {
  id                 String @id @default(cuid())
  organizationId     String
  contractId         String   // scoped to contract (PPN 06/21)
  reportingPeriodId  String
  measureId          String
  measure            SocialValueMeasure @relation(...)
  quantity           Decimal  // e.g., 3.5 FTE
  valuePounds        Decimal  // quantity × valuePerUnit
  evidenceFileId     String?
  notes              String?
  createdByUserId    String
  createdAt          DateTime @default(now())
}

model SocialValueTarget {
  id              String @id @default(cuid())
  organizationId  String
  contractId      String
  targetPounds    Decimal
  baselinePounds  Decimal?
  reportingPeriodId String
  createdAt       DateTime @default(now())
}
```

### 11.4 National TOMS Calculation

```
Social Value (£) = Σ (quantity_i × valuePerUnit_i) for all measures in scope

Proxy financial values (2025 TOMS, illustrative):
  T1/M1 Local employment (FTE)           → £18,500 / FTE
  T1/M3 Apprenticeship starts            → £8,000 / start
  T4/M4 Carbon reduction (beyond target) → £264 / tonne CO2e
  T5/M1 SME supply chain spend           → £0.02 / £ spent
  T5/M2 VCSE supply chain spend          → £0.03 / £ spent
```

### 11.5 API Endpoints Required

- `POST /api/orgs/[orgId]/social-value/records` — create social value record
- `GET /api/orgs/[orgId]/social-value/records` — list by contract/period
- `GET /api/orgs/[orgId]/social-value/summary` — total £ and breakdown by TOMS theme
- `POST /api/orgs/[orgId]/social-value/targets` — set PPN 06/21 target
- `GET /api/orgs/[orgId]/reports/ppn0621` — generate PPN 06/21 submission report

---

## 12. Dashboard Dependency Map

### 12.1 Dashboard Data Chain

```
ReportingPeriod
      │
      ▼
CalculationRun (status: succeeded)
      │
      ▼
PublishedSnapshot
      │
      ▼
DashboardAggregate rows (pre-computed)
  ├── scope (1/2/3)
  ├── emissionCategoryId
  ├── facilityId
  ├── businessUnitId
  ├── totalCo2e
  └── recordCount
      │
      ▼
GET /api/orgs/[orgId]/snapshots
      │
      ▼
Dashboard page components:
  ├── ScopeDonut (components/charts/scope-donut.tsx) — tCO2e by scope
  ├── CategoryBar (components/charts/category-bar.tsx) — tCO2e by category
  └── TrendLine (components/charts/trend-line.tsx) — period-over-period
```

### 12.2 Dashboard Performance Guarantee

- `DashboardAggregate` is always rebuilt synchronously at the end of `processCalculationRun()`
- Dashboard page queries `DashboardAggregate` — never `EmissionCalculation` directly
- Target: <3s for orgs with up to 100k activity records (per CLAUDE.md)
- Index on `(organizationId, reportingPeriodId, snapshotId)` ensures O(log n) lookups

### 12.3 Dashboard Gaps (Enterprise)

| Missing feature | Notes |
|---|---|
| Contract-level carbon totals | Requires Contract model + aggregate scoped to contractId |
| Site-level breakdown | Requires Site model + facilityId hierarchy |
| Social value £ on dashboard | Requires SocialValue engine |
| Real-time data quality panel | Currently no unresolved records count per category |
| Period-over-period % change | TrendLine exists but no delta calculation API |
| Carbon intensity metrics | e.g., tCO2e / £m contract value — no intensity denominator model |
| NHS Evergreen benchmark comparison | Requires NHS baseline data integration |
| CSRD materiality heatmap | Requires materiality assessment model |

---

## 13. Reporting Workflow

### 13.1 Current Report Generation Pipeline (Verified)

```
1. User requests report (web UI)
        │
        ▼
POST /api/orgs/[orgId]/reports
  • requireOrgMember (editor+)
  • requestHash dedup check (Report.requestHash)
  • Report row created (status: queued)
  • pg-boss enqueues "reports" job
        │
        ▼
workers/index.ts (concurrency: 1)
  → lib/reports/worker.ts: processReport(reportId, orgId)
        │
        ├── Fetch Report, PublishedSnapshot, DashboardAggregate
        ├── Fetch top emitters from EmissionCalculation
        ├── lib/reports/template.ts: generateReportHtml()
        │   ├── Summary table (total CO2e, period, methodology)
        │   ├── Scope 1/2/3 breakdown table
        │   ├── Category breakdown table
        │   ├── Top emitters table
        │   └── Historical trend table
        │
        ├── Puppeteer: launch Chrome → render HTML → export PDF
        ├── SHA-256 checksum computed
        ├── R2 upload: org/{orgId}/reports/{reportId}/report.pdf
        ├── Report.status → "ready"
        ├── Report.pdfStorageKey set
        └── AuditLog entry written
        │
        ▼
GET /api/orgs/[orgId]/reports/[reportId]/download
  → 15-min presigned R2 URL returned
```

### 13.2 Report Types Implemented

| Type | Status | Contents |
|---|---|---|
| `inventory` | Complete | Full period inventory, all scopes |
| `monthly_snapshot` | Complete | Single period summary |
| `audit_package` | Complete | Audit-ready format with factor citations |

### 13.3 Reporting Gaps (Enterprise)

| Missing report type | Standard | Priority |
|---|---|---|
| SECR (Streamlined Energy & Carbon) submission | SECR 2019 | P0 |
| PPN 06/21 social value + carbon report | Cabinet Office PPN | P0 |
| CSRD (Corporate Sustainability Reporting Directive) | EU ESRS | P1 |
| NHS Evergreen Sustainable Development Assessment | NHS England | P1 |
| Carbon Reduction Plan (CRP) — government supplier | PPN 06/21 | P0 |
| Supply chain carbon report (contractor → client deliverable) | Customer-specific | P1 |
| Power BI export (tabular dataset) | Microsoft Power BI | P2 |
| SAP integration (ABAP API) | SAP S/4HANA | P2 |

---

## 14. GitHub Actions Audit

### 14.1 Workflow Inventory (4 files)

| Workflow | File | Trigger | Status |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | push:main + PR | Active |
| Mobile Build | `.github/workflows/mobile-build.yml` | tags v* / dispatch | Active |
| Production DB | `.github/workflows/production-db.yml` | manual dispatch | Active |
| Neon Branch | `.github/workflows/neon_workflow.yml` | PR events | Active |

### 14.2 CI Workflow (`ci.yml` — 80 lines)

**Web job:**
- Node 22 + pnpm 10
- `pnpm install --frozen-lockfile`
- `pnpm prisma generate`
- `pnpm lint` (ESLint 9)
- `pnpm typecheck` (tsc --noEmit)
- `pnpm test` (Vitest)
- `pnpm build` (Next.js — requires all env vars as dummy values)

**Android job:**
- JDK 17 (Temurin) — required by AGP 9.0.1
- Flutter 3.x stable + cache
- `flutter pub get`
- `dart run build_runner build --delete-conflicting-outputs` (drift codegen)
- `flutter analyze --no-fatal-infos`
- `flutter build apk --release`
- Upload artifact: `metricora-release-{sha}.apk` (14-day retention)

**Known configuration (verified after recent fixes):**
- minSdk = 23 (ML Kit + flutter_secure_storage requirement)
- Kotlin 2.3.20 + AGP 9.0.1 + Gradle 9.1.0
- JVM heap: `-Xmx4G -XX:MaxMetaspaceSize=2G` (reduced from 8G to fix CI OOM)
- UCropActivity + ML Kit OCR manifest entries in place

### 14.3 Mobile Build Workflow (`mobile-build.yml` — 113 lines)

- Flutter 3.44.0 stable (pinned — not floating `3.x`)
- Builds APK + AAB (Play Store) for Android
- Unsigned iOS build (no App Store delivery)
- Keystore signing: reads `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` from GitHub Secrets
- Gracefully degrades to debug signing if secrets absent (CI-safe)
- METRICORA_API_BASE_URL injected at build time via `--dart-define`

### 14.4 Production DB Workflow (`production-db.yml` — 46 lines)

- Manual trigger only (safety gate)
- Validates `DATABASE_URL` format before running
- `prisma migrate deploy` (applies all pending migrations)
- Optionally `prisma db seed` (controlled by `run_seed` input)
- Reads `DATABASE_URL` from GitHub Actions environment secrets

### 14.5 Neon Branch Workflow (`neon_workflow.yml` — 95 lines)

- Creates a preview Neon branch per PR (isolated Postgres instance)
- Runs migrations + seed on the preview branch
- Outputs `db_url` and `db_url_with_pooler` for Vercel preview deploys
- Deletes the branch on PR close (14-day TTL safety net)

### 14.6 CI Gaps

| Gap | Impact | Fix |
|---|---|---|
| No iOS App Store signing workflow | Cannot ship iOS | Add Fastlane + Apple certs to secrets |
| No E2E test step in CI | No regression protection | Add Playwright/Vitest integration tests |
| No security scan (Trivy/Snyk) | Supply chain risk | Add `actions/dependency-review-action` |
| No Lighthouse / web vitals check | Performance regression | Add Lighthouse CI step |
| No SAST (CodeQL) | Code vulnerability blind spot | Add `github/codeql-action` |
| Puppeteer not cached | CI slow (Chromium download) | Add `puppeteer.config.ts` cache path |
| Worker process not tested in CI | Jobs may fail silently | Add `JOB_PROCESSING_MODE=inline` env in CI |

---

## 15. Security Review

### 15.1 Implemented Controls

| Control | Location | Assessment |
|---|---|---|
| HTTPS enforcement (HSTS) | `next.config.ts` + `middleware.ts` | ✓ Correct — 2-year HSTS with preload |
| X-Frame-Options: DENY | `next.config.ts` | ✓ Prevents clickjacking |
| X-Content-Type-Options: nosniff | `next.config.ts` | ✓ Prevents MIME sniffing |
| Referrer-Policy: strict-origin | `next.config.ts` | ✓ Limits referrer leakage |
| Permissions-Policy | `next.config.ts` | ✓ Blocks camera/mic/geo/payment |
| Cross-Origin-Opener-Policy | `next.config.ts` | ✓ Prevents cross-origin window access |
| Rate limiting (auth) | `middleware.ts` | ✓ 5 req/min per IP on `/api/auth` |
| Rate limiting (mutations) | `middleware.ts` | ✓ 10 req/min per IP |
| Zod validation | All API routes | ✓ At every API boundary |
| Org scoping | `lib/auth/session.ts` | ✓ Two-layer (session + DB filter) |
| Presigned URLs (15 min TTL) | `lib/storage/index.ts` | ✓ Never exposes raw R2 keys |
| Audit log (append-only) | `lib/db/audit.ts` | ✓ Cannot update/delete rows |
| JWT in flutter_secure_storage | Flutter / `core/api/client.dart` | ✓ Not in insecure shared prefs |
| InviteLink expiry + single-use | `prisma/schema.prisma` | ✓ `usedAt` set on acceptance |
| Idempotency keys | Multiple models | ✓ Prevents duplicate operations |

### 15.2 Security Gaps

#### CRITICAL (P0)

**SEC-01: No cross-tenant regression tests**
The CLAUDE.md explicitly flags cross-tenant access as a P0 bug, but no test file verifies that `orgId` from one session cannot access another org's data. A malicious actor who discovers another `orgId` (likely a CUID — not secret) could attempt to access that org's API.

**Verification:** `grep -r "cross.tenant\|orgId.*different\|another.org" lib/**/__tests__/` → 0 results

**Fix:** Add test suite in `lib/__tests__/cross-tenant.test.ts` that creates two orgs and verifies 403 on all cross-org API calls.

**SEC-02: Polymorphic targetId not FK-validated**
`ReviewTask.targetId` and `Comment.targetId` are plain strings (no FK). Application code must resolve the target type. If a route handler fails to validate that the `targetId` belongs to the requesting org, a user could reference another org's resource ID.

**Affected code:** `lib/review-tasks/targets.ts` and all comment routes.

**Fix:** Add `organizationId` filter when resolving polymorphic targets.

**SEC-03: OSRM using public API (data leakage)**
Route distance calculations (`lib/geo/route-distance.ts`) send pickup and delivery postcodes to `https://router.project-osrm.org`. This sends client address data to a third-party service with no SLA, no DPA, and no data retention controls. For NHS/MOD tenants this will block procurement.

**Fix:** Self-host OSRM with UK road network, or switch to HERE Routes API under a data processing agreement.

#### HIGH (P1)

**SEC-04: Rate limiting is in-memory only**
The `lib/security/rate-limit.ts` implementation uses an in-memory `Map`. Under horizontal scaling (multiple Vercel serverless instances), each instance maintains its own counter — an attacker can bypass limits by distributing requests across instances.

**Fix:** Move rate limit state to Redis (Upstash Serverless Redis — free tier) or use Vercel's Edge Config rate limiting.

**SEC-05: Content Security Policy not set**
`next.config.ts` and `middleware.ts` set many security headers but no `Content-Security-Policy`. Without CSP, XSS payloads can exfiltrate session cookies and auth tokens.

**Fix:** Add `Content-Security-Policy` header with `default-src 'self'`, allowlisting Cloudflare R2, Recharts CDN (if any), and Google ML Kit (mobile only).

**SEC-06: No secret scanning in CI**
No Trivy, GitGuardian, or GitHub's own `actions/dependency-review-action` runs in CI. A committer who accidentally includes an API key in a commit would not be alerted.

**Fix:** Add `github/codeql-action` + `actions/dependency-review-action` to `ci.yml`.

**SEC-07: Firebase service account JSON as env var**
`FIREBASE_SERVICE_ACCOUNT_JSON` is stored as a single large JSON string env var. This is a high-value secret that, if leaked, grants FCM push access to all devices.

**Fix:** Use Google Cloud Workload Identity Federation for GitHub Actions; use Vercel's encrypted env var system for production.

#### MEDIUM (P2)

**SEC-08: No password strength enforcement**
Better Auth's email/password strategy has no minimum password complexity configured beyond Better Auth defaults. Enterprise tenants (especially NHS/MOD) require NCSC password guidance compliance.

**SEC-09: No session invalidation on role change**
When a user's role is changed (PATCH `/api/orgs/[orgId]/members/[memberId]`), existing sessions are not invalidated. A downgraded user retains their old role permissions until their session expires (7 days).

**Fix:** Call `auth.revokeUserSessions(userId)` after role changes.

**SEC-10: Puppeteer sandbox**
Puppeteer runs Chromium. Without `--no-sandbox` flag in a Docker environment (or with correct seccomp/AppArmor profiles on Vercel), PDF generation may fail or run insecurely. The current Vercel deployment runs Puppeteer in a serverless context — this needs explicit testing.

---

## 16. Technical Debt Register

| ID | Description | Location | Severity | Effort |
|---|---|---|---|---|
| TD-001 | Duplicate rate-limit modules | `lib/rate-limit.ts` vs `lib/security/rate-limit.ts` | Medium | 0.5d |
| TD-002 | kysely 0.28.8 pinned due to breaking change in 0.29.x | `package.json:17` | Medium | 1d (track upstream fix) |
| TD-003 | Duplicate activity-record routes | `/api/orgs/[orgId]/records/` and `/api/orgs/[orgId]/activity-records/` | Medium | 1d |
| TD-004 | No OpenAPI schema | 82 routes with no machine-readable spec | High | 3d |
| TD-005 | No integration tests | Only unit tests — no end-to-end pipeline test | High | 5d |
| TD-006 | No cross-tenant security test | P0 security gap per CLAUDE.md | Critical | 2d |
| TD-007 | Public OSRM API (data leakage) | `lib/geo/route-distance.ts:L1` + `.env.example` | Critical | 3d |
| TD-008 | In-memory rate limiting | `lib/security/rate-limit.ts` | High | 2d |
| TD-009 | No Content Security Policy header | `next.config.ts`, `middleware.ts` | High | 1d |
| TD-010 | Hardcoded brand name in Android manifest | `android/app/src/main/AndroidManifest.xml:11` | Medium | 1d |
| TD-011 | No billing/plan model | Schema — missing Plan, Subscription, Invoice | High | 5d |
| TD-012 | No contract/project/site hierarchy | Schema — flat Organization → Facility | Critical | 10d |
| TD-013 | No social value models | Schema — no TOMS models at all | High | 7d |
| TD-014 | No white-label branding model | Schema + middleware — no subdomain routing | High | 7d |
| TD-015 | No platform-level admin role | Schema + auth — no PlatformMembership | High | 5d |
| TD-016 | Fixed currency exchange rates | `lib/calculation/units.ts:29-41` | Medium | 3d |
| TD-017 | No spend-based factor fallback | `lib/calculation/factor-selector.ts` | Medium | 2d |
| TD-018 | Transport postcodes → CO2e not automatic | `lib/calculation/run-worker.ts` | Medium | 2d |
| TD-019 | Only 38 factors seeded (construction/waste missing) | `prisma/seed.ts` | High | 7d |
| TD-020 | No web-side OCR pipeline | `lib/imports/worker.ts` | High | 5d |
| TD-021 | No SECR/CSRD/PPN 06/21 report templates | `lib/reports/template.ts` | High | 10d |
| TD-022 | Session not invalidated on role change | `app/api/orgs/[orgId]/members/[memberId]/route.ts` | High | 0.5d |
| TD-023 | No PostGIS spatial indexing | `prisma/schema.prisma` (PostcodeGeocode model) | Medium | 3d |
| TD-024 | Puppeteer Vercel sandbox not tested | `lib/reports/worker.ts` | Medium | 1d |
| TD-025 | No CI security scanning (Trivy/CodeQL) | `.github/workflows/ci.yml` | High | 1d |

---

## 17. Remediation Plan

### 17.1 Immediate Fixes (Days 1–5)

These can be done without schema changes and have no migration risk.

| # | Fix | Effort | Owner |
|---|---|---|---|
| R-01 | Delete `lib/rate-limit.ts` (keep `lib/security/rate-limit.ts`) | 0.5d | Backend |
| R-02 | Add `Content-Security-Policy` header to `next.config.ts` | 1d | Backend |
| R-03 | Add cross-tenant regression test suite | 2d | QA |
| R-04 | Invalidate sessions on role change | 0.5d | Backend |
| R-05 | Add CodeQL + dependency-review to CI | 1d | DevOps |

### 17.2 Short-term (Weeks 2–4)

| # | Fix | Effort | Owner |
|---|---|---|---|
| R-06 | Replace public OSRM with self-hosted or HERE API (DPA in place) | 3d | Backend |
| R-07 | Move rate limiting to Upstash Redis (free tier) | 2d | Backend |
| R-08 | Eliminate duplicate activity-record routes (deprecate `/activity-records/`) | 1d | Backend |
| R-09 | Implement postcodes → km → CO2e auto-calculation in run-worker | 2d | Backend |
| R-10 | Add spend-based factor fallback in factor-selector | 2d | Backend |
| R-11 | Add Puppeteer smoke test in CI (capture PDF, verify non-empty) | 1d | QA |
| R-12 | Add integration test: import → commit → calculate → snapshot → report | 5d | QA |
| R-13 | Update `BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION=true` for production | 0.5d | Backend |

### 17.3 Medium-term (Months 2–3) — Schema Migrations

These require Prisma migrations and coordinated deployment.

| # | Fix | Effort | Risk |
|---|---|---|---|
| R-14 | Add `TenantBranding` model + subdomain routing | 7d | Low |
| R-15 | Add `PlatformMembership` + platform-level routes | 5d | Low |
| R-16 | Add `Contract`, `Project`, `Site` models to hierarchy | 10d | Medium |
| R-17 | Extend RBAC to 15 roles (enum additions are non-breaking) | 3d | Low |
| R-18 | Add Social Value models (TOMS) | 7d | Low |
| R-19 | Expand emission factors: construction + waste treatment categories | 7d | Low |
| R-20 | Add `Plan`, `Subscription` billing models | 5d | Medium |
| R-21 | Enable PostGIS on Neon + migrate geocode fields to geography type | 3d | Medium |

### 17.4 Long-term (Months 3–6) — Enterprise Features

| # | Fix | Effort | Value |
|---|---|---|---|
| R-22 | Web-side OCR pipeline (Claude vision API for PDFs) | 5d | High |
| R-23 | SECR report template | 5d | High |
| R-24 | PPN 06/21 / CRP report template | 5d | High |
| R-25 | CSRD ESRS report template | 10d | High |
| R-26 | NHS Evergreen assessment integration | 7d | Medium |
| R-27 | AI waste classification endpoint | 3d | High |
| R-28 | Power BI tabular dataset export | 5d | Medium |
| R-29 | White-label Flutter app build pipeline | 10d | High |
| R-30 | OpenAPI schema generation (Zodios or tRPC) | 5d | Medium |

---

## 18. Cost Analysis

### 18.1 Current Infrastructure Costs (MVP, Free Tier)

| Service | Tier | Monthly Cost | Limit |
|---|---|---|---|
| Neon Postgres | Free | £0 | 0.5 GB storage, 100 compute-hours |
| Cloudflare R2 | Free | £0 | 10 GB/month, zero egress |
| Resend | Free | £0 | 3,000 emails/month (100/day) |
| Firebase FCM | Free | £0 | Unlimited push |
| Vercel | Hobby | £0 | 100 GB-hours/month |
| GitHub Actions | Free | £0 | 2,000 minutes/month |
| **Total** | | **£0/month** | |

### 18.2 Production Infrastructure Costs (Per 10 Enterprise Tenants)

| Service | Tier | Monthly Cost | Notes |
|---|---|---|---|
| Neon Postgres | Scale | ~£50–120 | Multiple compute units, 20 GB storage |
| Cloudflare R2 | Pay-as-you-go | ~£5–20 | ~100 GB evidence + PDF storage |
| Resend | Pro | £17 | 50,000 emails/month |
| Firebase | Spark (free) | £0 | |
| Vercel | Pro | £17 | Team plan, preview deploys |
| Upstash Redis | Pay-as-you-go | ~£3–10 | Rate limiting state |
| HERE Routes API | Freemium | ~£0–20 | 250k free calls/month |
| **Total** | | **~£92–204/month** | ~£10–20/tenant/month |

### 18.3 Per-Tenant Cost Breakdown (Enterprise Scale)

At 50 tenants, 2,000 active users, 500k activity records:

| Service | Monthly Cost |
|---|---|
| Neon Postgres Business | ~£300 |
| Cloudflare R2 (500 GB) | ~£50 |
| Resend Business | ~£50 |
| Vercel Pro | £17 |
| Upstash Redis | ~£20 |
| HERE Routes (2M calls) | ~£150 |
| Puppeteer workers (Vercel Functions) | ~£30 |
| **Total** | **~£617/month** |
| Per tenant | **~£12.34/month** |

### 18.4 Avoided Costs

By using the current zero-cost stack vs. alternatives:

| Component | Alternative | Avoided Cost |
|---|---|---|
| Redis (BullMQ) | Upstash / Redis Cloud | £20–200/month |
| OCR API (cloud) | Google Vision / AWS Textract | £50–500/month at scale |
| ML calculation service | Python ML service (Docker) | £30–100/month (hosting) |
| SQL Server | vs PostgreSQL | £150–500/month |
| **Total avoided** | | **£250–1,300/month** |

### 18.5 Pricing Model Recommendation

For the Fluid enterprise tier:

| Plan | Target | Price | Includes |
|---|---|---|---|
| Starter | SME, 1 org, <5 users | £149/month | 5k records, basic reports |
| Professional | Mid-market, 1 org, <25 users | £499/month | 100k records, all report types, field app |
| Enterprise | Large org / multiple contracts | £1,500+/month | Unlimited, white-label, SSO, API access |
| Platform (reseller) | Consultancies selling to clients | £3,000+/month | Multi-tenant, branded portals, priority support |

---

## 19. Scalability Plan

### 19.1 Current Bottlenecks

| Bottleneck | Current Limit | Mitigation |
|---|---|---|
| pg-boss queue (Postgres-backed) | ~1,000 jobs/min | For enterprise scale, migrate to BullMQ + Upstash Redis |
| In-memory rate limiting | Not distributed | Upstash Redis (see SEC-04) |
| Puppeteer PDF generation | Sequential (concurrency: 1) | Increase concurrency, add PDF worker pool |
| DashboardAggregate rebuild | Full rebuild per calc run | Incremental upsert (only changed categories/facilities) |
| OSRM geocoding | Public API rate limits | Self-hosted UK OSRM or HERE API |
| Neon free tier | 0.5 GB, 100 compute-hours/month | Neon Scale or dedicated Postgres (Supabase Pro, RDS) |

### 19.2 Scaling Path

**0 → 100 tenants (Phase 1 — Neon + Vercel)**
- Upgrade Neon to Business plan (autoscale + connection pooler built-in)
- Enable Neon connection pooling (PgBouncer mode) — no code changes
- Move pg-boss worker to a dedicated Vercel Serverless Function on cron (avoid cold starts)
- Add Redis for rate limiting (Upstash free tier → pay-as-you-go)
- Target: 100k activity records per tenant, <3s dashboard

**100 → 1,000 tenants (Phase 2 — Horizontal scale)**
- Migrate to BullMQ + Upstash Redis for job queue (remove pg-boss dependency)
- Add read replicas via Neon branching (queries go to replica, writes to primary)
- Shard DashboardAggregate rebuild to be incremental (not full-rebuild)
- Introduce `CACHE-CONTROL` headers on dashboard API endpoints (1-min stale-while-revalidate)
- PostGIS migration for spatial queries
- CDN edge caching for evidence file downloads (Cloudflare cache rules for R2)

**1,000+ tenants (Phase 3 — Multi-region)**
- Deploy Neon branches per region (EU West, UK South, US East)
- Vercel Edge Runtime for middleware (move rate limiting to Edge)
- Distributed tracing with OpenTelemetry → Axiom (free tier: 500 GB/month ingest)
- Tenant data residency controls (required for NHS, MOD procurement)

### 19.3 Database Scaling Targets

| Milestone | Records | DB size | Dashboard latency |
|---|---|---|---|
| Current (MVP) | 10k | 50 MB | <1s |
| 10 tenants | 500k | 2 GB | <2s |
| 100 tenants | 10M | 40 GB | <3s |
| 1,000 tenants | 100M | 400 GB | <3s (with read replicas + aggregates) |

### 19.4 Performance-Critical Indexes (Add Before Scale)

```sql
-- Time-range queries on activity records
CREATE INDEX idx_activity_record_activity_date
  ON "ActivityRecord" (organization_id, activity_date);

-- Site-level field submission queries
CREATE INDEX idx_field_submission_facility
  ON "FieldSubmission" (organization_id, facility_id, created_at);

-- Factor selection performance
CREATE INDEX idx_emission_factor_selection
  ON "EmissionFactor" (factor_library_id, emission_category_id, effective_start_date);

-- Audit log time-range queries
CREATE INDEX idx_audit_log_actor
  ON "AuditLog" (organization_id, actor_user_id, created_at);
```

---

## 20. MVP vs Enterprise Gap Analysis

### 20.1 Feature Gap Matrix

| Capability | MVP (MetricOra) | Enterprise (Fluid) | Gap |
|---|---|---|---|
| **Multi-tenancy depth** | Org (flat) | Platform→Tenant→BU→Contract→Project→Site | 🔴 Critical |
| **White-label portals** | None | Unlimited branded subdomains | 🔴 Critical |
| **RBAC roles** | 6 | 15 | 🔴 Critical |
| **Platform admin** | None | Platform Owner / Support / Analyst | 🔴 Critical |
| **Social Value (TOMS)** | None | Full National TOMS engine | 🔴 Critical |
| **Reporting standards** | GHG Protocol only | + SECR, CSRD, PPN 06/21, NHS Evergreen | 🔴 Critical |
| **OCR** | Mobile only (ML Kit) | + Web (Claude vision) + AI classification | 🟠 High |
| **Emission factors** | 38 (MVP categories) | 500+ (construction, waste, freight) | 🟠 High |
| **Billing / plans** | None | Full SaaS billing model | 🟠 High |
| **Contract-level reporting** | None | PPN 06/21 per-contract carbon plan | 🟠 High |
| **Spatial analysis** | postcodes.io → OSRM | PostGIS + self-hosted routing | 🟠 High |
| **Transport chain CO2e** | Manual distance entry | Auto: postcode pair → km → CO2e | 🟠 High |
| **AI waste classification** | None | Claude → EWC code suggestion | 🟡 Medium |
| **Power BI integration** | None | Tabular dataset export | 🟡 Medium |
| **SAP connector** | None | SAP ABAP API / iDoc | 🟡 Medium |
| **NHS Evergreen** | None | Assessment + benchmark | 🟡 Medium |
| **CSRD reporting** | None | ESRS E1, E2, S1 reports | 🟡 Medium |
| **Supply chain traceability** | Evidence photos only | Full document provenance chain | 🟡 Medium |
| **Carbon intensity metrics** | None | tCO2e / £m revenue, per product | 🟡 Medium |
| **SSO / SAML** | Email/password + JWT | SAML 2.0 / Azure AD | 🟡 Medium |
| **Rate limiting (distributed)** | In-memory | Redis (Upstash) | 🟡 Medium |
| **Security regression tests** | None | Full cross-tenant suite | 🟡 Medium |
| **API documentation** | None | OpenAPI 3.1 + SDK | 🟡 Medium |
| **Audit log export** | Viewer UI | CSV / Splunk / SIEM export | 🟢 Low |
| **Multi-language** | English only | Welsh, French, German | 🟢 Low |

### 20.2 Gap Impact Summary

| Priority | Count | Description |
|---|---|---|
| 🔴 Critical (blocks enterprise contracts) | 6 | Hierarchy, white-label, RBAC, social value, standards |
| 🟠 High (blocks procurement qualification) | 7 | Factors, billing, contract reports, spatial, OCR |
| 🟡 Medium (reduces competitive win rate) | 10 | AI, integrations, intensity, SSO |
| 🟢 Low (nice to have) | 3 | Audit export, multi-language, etc. |

---

## 21. Prioritised Implementation Roadmap

### Sprint 0 — Security & Quality Foundations (Weeks 1–2)

**Goal:** Make the existing codebase production-safe.

| Task | File | Days | Priority |
|---|---|---|---|
| Delete `lib/rate-limit.ts` (use `lib/security/rate-limit.ts` only) | `lib/rate-limit.ts` | 0.5 | P0 |
| Add Content-Security-Policy header | `next.config.ts` | 1 | P0 |
| Add cross-tenant regression test suite | `lib/__tests__/cross-tenant.test.ts` | 2 | P0 |
| Invalidate sessions on role change | `app/api/orgs/[orgId]/members/[memberId]/route.ts` | 0.5 | P0 |
| Replace public OSRM with HERE API (DPA) | `lib/geo/route-distance.ts` | 2 | P0 |
| Add CodeQL + dependency-review to CI | `.github/workflows/ci.yml` | 0.5 | P0 |
| Move rate limiting to Upstash Redis | `lib/security/rate-limit.ts` | 2 | P1 |
| Add integration test (import→calc→report) | `lib/__tests__/pipeline.test.ts` | 5 | P1 |

### Sprint 1 — Data Model Expansion (Weeks 3–6)

**Goal:** Extend schema to support enterprise hierarchy and white-label.

| Task | Migration | Days | Priority |
|---|---|---|---|
| Add `TenantBranding` model | new migration | 3 | P0 |
| Add subdomain routing to middleware | `middleware.ts` | 1 | P0 |
| Add `PlatformMembership` + `PlatformRole` enum | new migration | 2 | P0 |
| Add platform-level API routes | `app/api/platform/` | 3 | P0 |
| Extend RBAC: 6 → 15 roles | enum `ALTER TYPE` migration | 2 | P0 |
| Add `Contract`, `Project`, `Site` models | new migration | 5 | P0 |
| Update all org-scoped routes to support contract/project scoping | Multiple routes | 5 | P0 |
| Add Social Value models (TOMS) | new migration | 3 | P1 |
| Add Social Value API routes | `app/api/orgs/[orgId]/social-value/` | 3 | P1 |
| Add `Plan`, `Subscription` billing models | new migration | 3 | P1 |

### Sprint 2 — Carbon Engine Expansion (Weeks 7–9)

**Goal:** Comprehensive emission factors covering construction and waste verticals.

| Task | File | Days | Priority |
|---|---|---|---|
| Seed full DEFRA 2025 construction materials factors | `prisma/seed.ts` | 3 | P0 |
| Seed EWC waste treatment factors (all 35 chapters) | `prisma/seed.ts` | 3 | P0 |
| Seed freight factors (sea, air, rail, HGV by load) | `prisma/seed.ts` | 2 | P0 |
| Auto-chain: postcode pair → route km → CO2e in run-worker | `lib/calculation/run-worker.ts` | 2 | P0 |
| Add spend-based EEIO fallback in factor-selector | `lib/calculation/factor-selector.ts` | 2 | P1 |
| Add UK regional grid intensity by postcode area | `prisma/seed.ts` | 2 | P1 |
| Add carbon intensity metrics API (tCO2e / £m) | New route | 2 | P1 |
| Seed full refrigerant R-series | `prisma/seed.ts` | 1 | P1 |

### Sprint 3 — Reporting Standards (Weeks 10–13)

**Goal:** SECR + PPN 06/21 / CRP report templates (both required for UK government supplier registration).

| Task | File | Days | Priority |
|---|---|---|---|
| SECR report HTML template | `lib/reports/template.ts` | 5 | P0 |
| PPN 06/21 Carbon Reduction Plan template | `lib/reports/template.ts` | 5 | P0 |
| Contract-level social value + carbon bundle report | `lib/reports/template.ts` | 3 | P0 |
| CSRD ESRS E1 report template | `lib/reports/template.ts` | 7 | P1 |
| NHS Evergreen assessment template | `lib/reports/template.ts` | 5 | P1 |
| Report API endpoints for new types | Multiple routes | 3 | P0 |
| Add report type to `ReportType` enum | migration | 0.5 | P0 |

### Sprint 4 — AI & OCR Enhancement (Weeks 14–16)

**Goal:** Web-side OCR and AI-powered waste classification.

| Task | File | Days | Priority |
|---|---|---|---|
| Web PDF OCR extraction layer (Claude vision) | `lib/imports/worker.ts` | 5 | P1 |
| AI waste classification endpoint | `app/api/orgs/[orgId]/waste-classifier/route.ts` | 3 | P1 |
| EWC code suggestion from OCR text | `lib/imports/worker.ts` | 2 | P1 |
| Import OCR quality confidence scoring | `StagedActivityRecord.data` | 2 | P2 |

### Sprint 5 — White-Label & Integrations (Weeks 17–20)

**Goal:** Branded tenant portals and enterprise integrations.

| Task | File | Days | Priority |
|---|---|---|---|
| CSS custom property injection from TenantBranding | Layout + middleware | 2 | P0 |
| Logo/favicon upload endpoint | New API route | 2 | P0 |
| Report PDF branding (Puppeteer header) | `lib/reports/worker.ts` | 2 | P0 |
| Email from-domain per tenant (Resend) | `lib/notifications/email.ts` | 1 | P1 |
| OpenAPI 3.1 schema generation | New CI step | 5 | P1 |
| Power BI tabular dataset export (OData) | New API route | 5 | P2 |
| SAML 2.0 / Azure AD SSO | Better Auth SAML plugin | 7 | P1 |
| White-label Flutter build pipeline | CI + flavour config | 7 | P1 |

### Sprint 6 — PostGIS & Spatial (Weeks 21–22)

**Goal:** Spatial queries for site-to-facility routing and geographic analysis.

| Task | File | Days | Priority |
|---|---|---|---|
| Enable PostGIS on Neon | Migration | 1 | P2 |
| Migrate PostcodeGeocode to geography columns | Migration | 2 | P2 |
| Add GiST spatial indexes | Migration | 0.5 | P2 |
| Facility catchment matching (nearest site to postcode) | New API endpoint | 3 | P2 |
| Heat map data API (tCO2e by geographic cluster) | New API endpoint | 3 | P2 |

### Roadmap Summary

| Milestone | Weeks | Key Deliverable |
|---|---|---|
| Sprint 0 | 1–2 | Production-safe MVP: CSP, cross-tenant tests, HERE routing |
| Sprint 1 | 3–6 | Enterprise schema: hierarchy + white-label + 15-role RBAC |
| Sprint 2 | 7–9 | Full construction/waste factor library: 500+ factors |
| Sprint 3 | 10–13 | SECR + PPN 06/21 + CSRD reports: government supplier ready |
| Sprint 4 | 14–16 | Web OCR + AI waste classification |
| Sprint 5 | 17–20 | White-label portals + OpenAPI + SAML SSO |
| Sprint 6 | 21–22 | PostGIS spatial queries |
| **Total** | **22 weeks** | **Fluid Enterprise v1.0** |

---

## Appendix A — Competitive Positioning

| Platform | Strengths | Weakness vs Fluid |
|---|---|---|
| **BRE SmartWaste** | Mature waste tracking, BRE brand trust | No mobile OCR, no social value, outdated UI |
| **Sphera** | Fortune 500 client base, deep EHS | Complex, expensive, no field capture |
| **Greenly** | Beautiful UX, strong SME market | No waste/construction vertical, no field workers |
| **Emitwise** | AI-powered Scope 3 | No mobile, no social value, US-centric |
| **Normative** | Strong Scope 3 supply chain | No site-level capture, no UK construction focus |
| **EcoVadis** | Supplier ratings, brand recognition | Not a carbon tracking tool — ratings only |
| **Fluid (target)** | Mobile OCR + offline, social value + carbon, PPN 06/21 native, white-label, zero-cost stack | Newer platform — needs enterprise reference customers |

**Fluid's defensible moat:** The combination of field-level evidence capture (offline OCR on construction sites) + automated transport carbon calculations + National TOMS social value + PPN 06/21 reporting is not offered by any single competitor. The vertical focus (construction, waste haulage) with regulatory-ready output differentiates from horizontal GHG platforms.

---

## Appendix B — Glossary

| Term | Definition |
|---|---|
| **CSRD** | Corporate Sustainability Reporting Directive — EU mandatory reporting from 2025 |
| **DEFRA** | UK Department for Environment, Food & Rural Affairs — publishes annual GHG conversion factors |
| **EWC** | European Waste Catalogue — 6-digit waste classification codes (e.g., 17 05 04 = soil containing hazardous substances) |
| **GHG Protocol** | Greenhouse Gas Protocol Corporate Standard — globally accepted accounting methodology |
| **GWP** | Global Warming Potential — CO2-equivalence multiplier (CH4=27.9, N2O=273 for AR6) |
| **NHS Evergreen** | NHS Sustainable Development Assessment Tool — annual self-assessment for NHS suppliers |
| **OSRM** | Open Source Routing Machine — road network routing engine |
| **PPN 06/21** | Procurement Policy Note 06/21 — UK government requirement for suppliers to have a Carbon Reduction Plan |
| **PostGIS** | PostgreSQL spatial extension — geography and geometry types, `ST_Distance`, `ST_Within` |
| **SECR** | Streamlined Energy & Carbon Reporting — UK mandatory reporting for large businesses |
| **TOMS** | Themes, Outcomes, Measures — the National TOMs Framework for measuring social value in public procurement |

---

*End of Fluid Repository Audit — 21 Deliverables*  
*Document generated: 2026-06-13*  
*Next review: Before Sprint 1 kickoff*
