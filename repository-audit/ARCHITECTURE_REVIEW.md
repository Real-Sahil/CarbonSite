# Architecture Review — CarbonSite

---

## Current Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                  │
│  ┌────────────────────────┐   ┌──────────────────────────────┐  │
│  │  Web App (Next.js 16)  │   │  Flutter Mobile (Dart/iOS/   │  │
│  │  App Router + React 19 │   │  Android)                    │  │
│  │  Cookie-based sessions │   │  JWT Bearer token            │  │
│  └────────────┬───────────┘   └──────────────┬───────────────┘  │
└───────────────┼──────────────────────────────┼──────────────────┘
                │ HTTPS                         │ HTTPS
┌───────────────▼──────────────────────────────▼──────────────────┐
│                Next.js API Routes (App Router)                    │
│  /api/auth/[...all]         Better Auth (cookie + JWT)           │
│  /api/auth/accept-invite    Field worker onboarding              │
│  /api/orgs/                 Org CRUD                             │
│  /api/orgs/[orgId]/*        All org-scoped endpoints             │
│  /api/uploads/presign       S3-compatible presigned URL gen      │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
┌─────────▼──────────┐  ┌──────────▼──────────┐  ┌──────────▼───────────┐
│  PostgreSQL (Neon)  │  │   pg-boss Workers   │  │   Cloudflare R2      │
│  Prisma ORM         │  │   (separate process)│  │   (object storage)   │
│  Better Auth tables │  │   imports           │  │   org/{orgId}/...    │
│  Job queue tables   │  │   calculations      │  │   15-min signed URLs │
│  All tenant data    │  │   reports           │  └──────────────────────┘
└─────────────────────┘  │   notifications     │
                         └─────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
           ┌────────▼──────────┐       ┌───────────▼──────────┐
           │   Resend (email)  │       │   Firebase FCM (push) │
           │   free: 3k/month  │       │   Flutter app only    │
           └───────────────────┘       └──────────────────────┘
```

### Data Flow: Web User Creates an Activity Record

```
Browser → POST /api/orgs/{orgId}/imports
        → requireOrgMember (2 DB queries)
        → Zod validation
        → prisma.importBatch.create (staging)
        → presignUpload (S3 client → R2)
        → enqueueImport (pg-boss → Postgres queue)
        → Worker picks up job
        → [STUB — not yet implemented]
        → parse CSV, validate rows
        → prisma.stagedActivityRecord.createMany
        → ImportBatch.state = 'ready_to_commit'
        → User reviews → POST /api/.../imports/{id}/commit
        → ActivityRecord rows created
```

### Data Flow: Field Worker Submits Evidence

```
Flutter → camera → OCR extraction (on-device, no API)
        → save to drift/SQLite (offline first)
        → sync: POST /api/orgs/{orgId}/field-submissions
        → server: requireOrgMember (JWT session)
        → prisma.fieldSubmission.create
        → enqueueNotification (reviewer alert)
        → Web reviewer: GET /submissions → list
        → PATCH /api/orgs/{orgId}/field-submissions/{id}/review
        → approved → prisma.activityRecord.create
```

---

## Frontend Architecture

### Next.js (Web)

- **App Router** with route groups: `(app)` for authenticated org shell, `(auth)` for sign in/up
- **Server Components by default** — data fetching in page components with direct Prisma calls
- **Client Components** only where interactivity is needed: forms, sidebar navigation, invite generators
- **Layout hierarchy**: `app/layout.tsx` → `(app)/layout.tsx` → `orgs/[orgId]/layout.tsx` → page

**Issues:**
- No error boundary (`error.tsx`) at any route level — unhandled promise rejections in server components will produce blank pages in production
- `orgs/[orgId]/layout.tsx` makes two serial DB calls (requireOrgMember, then org lookup) — should be parallelized
- Dashboard page contains only placeholder/skeleton UI; dashboard link in sidebar navigates to a non-functional page
- Sidebar navigation links to 5 routes that have no page component: `/records`, `/imports`, `/reports`, `/targets`, `/calculations` — users get 404

### Flutter (Mobile)

- **Riverpod** for dependency injection — `ProviderScope` at root
- **GoRouter** for navigation — async redirect checks `flutter_secure_storage`
- **Dio** singleton for HTTP with JWT interceptor
- **Drift/SQLite** declared as dependency but no schema file exists

**Issues:**
- Only `routerProvider` and `sessionTokenProvider` exist as Riverpod providers; all data fetching is done directly in widgets — no StateNotifier/AsyncNotifier pattern
- `sessionTokenProvider` is a one-shot `FutureProvider` — does not listen for token changes
- No `GoRouterRefreshStream` — router does not reactively respond to auth state changes
- `invalidateClient()` is never called (no sign-out flow in Flutter)

---

## Backend Architecture

### API Route Patterns

Every org-scoped route follows the same guard pattern:
```typescript
const { orgId } = await params;
const { session } = await requireOrgMember(orgId, ...allowedRoles);
const body = schema.parse(await req.json());
// DB operations
await writeAuditLog(…);
return NextResponse.json(result);
```

This is correct and consistent. The guard is not bypassable from the client.

### Background Jobs (pg-boss)

```
Web process: enqueueImport() / enqueueCalculation() / enqueueReport() / enqueueNotification()
  └─ boss.send() → pg_boss.job table in Postgres

Worker process (pnpm worker):
  └─ boss.work() → SELECT FOR UPDATE SKIP LOCKED → handler → job completion
```

**Issues:**
- All four handlers are stubs — no actual work is performed
- Worker creates a NEW `PgBoss` instance instead of using the shared lib singleton (harmless in practice since worker is a separate process, but creates two connection pools)
- No graceful shutdown handling (`process.on('SIGTERM')` → `boss.stop()`)
- No dead-letter queue or alerting when jobs exhaust retries

---

## Database Architecture

### Schema Health

The schema is comprehensive and well-designed for the product:
- All tenant tables include `organizationId`
- `EmissionCalculation` rows are immutable (no update operations defined)
- `AuditLog` is append-only
- `DashboardAggregate` exists for pre-computed dashboard totals
- `PublishedSnapshot` + `CalculationRun` pattern supports immutable versioned calculations

### Missing Indexes

No `@@index` directives exist in `schema.prisma`. The following are critical:

| Table | Column(s) | Query type | Priority |
|---|---|---|---|
| `InviteLink` | `token` | Unique lookup on accept-invite | P0 |
| `AuditLog` | `(organizationId, createdAt)` | Paginated audit queries | P0 |
| `ActivityRecord` | `(organizationId, reportingPeriodId, reviewStatus, createdAt)` | Dashboard aggregation | P0 |
| `FieldSubmission` | `(organizationId, status, createdAt)` | Submissions inbox | P1 |
| `EmissionCalculation` | `(activityRecordId, calculationRunId)` | Per-record calculation lookup | P1 |
| `OrganizationMembership` | `(organizationId)` | Member list | P1 |
| `Session` | `(userId, expiresAt)` | Session cleanup | P2 |

Note: `OrganizationMembership` has a `@@unique([organizationId, userId])` constraint which Postgres automatically indexes, so the membership lookup in `requireOrgMember` is covered. Other tables are not.

---

## Infrastructure Architecture

### Current State

| Component | Provider | Status |
|---|---|---|
| Database | Neon Postgres (or local) | Config present, no migration in CI |
| Object storage | Cloudflare R2 / local filesystem | Working (local driver) |
| Email | Resend / console | Worker stub only |
| Push notifications | Firebase FCM | Worker stub only |
| CDN / Edge | None configured | Missing |
| Deployment | None configured | Missing |
| Observability | None | Missing |
| Health checks | None | Missing |

### Single Points of Failure

1. **Postgres** — The only database. pg-boss queue shares the same instance. A DB outage takes down both the web app and the job queue simultaneously.
2. **Worker process** — A single `pnpm worker` process handles all four job types. No horizontal scaling, no health monitoring, no auto-restart.
3. **No CDN** — All assets served from Next.js; R2 presigned URLs bypass CDN for evidence files.

---

## Recommended Target Architecture

```
                    ┌─────────────────────────┐
                    │      Vercel / Fly.io     │
                    │  Next.js edge functions  │
                    │  + standalone server     │
                    └────────────┬────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                       │
┌─────────▼──────────┐  ┌───────▼──────────┐  ┌────────▼───────────┐
│  Neon Postgres      │  │  Worker (Fly.io) │  │  Cloudflare R2     │
│  + connection pool  │  │  pg-boss handler │  │  + CDN cache for   │
│  (PgBouncer/Neon)   │  │  (can scale out) │  │  public assets     │
└─────────────────────┘  └──────────────────┘  └────────────────────┘
                                                          │
                                             ┌────────────▼──────────┐
                                             │  Observability         │
                                             │  - Sentry (errors)     │
                                             │  - Axiom / Logtail     │
                                             │    (structured logs)   │
                                             └───────────────────────┘
```

**Key changes from current:**
1. Add structured logging middleware (request_id, org_id, user_id per CLAUDE.md spec)
2. Add `/api/health` endpoint for load balancer checks
3. Separate worker deployment with auto-restart and health check
4. Add PgBouncer or Neon's built-in pooling to limit DB connections
5. Add Redis/Upstash for rate limiting (or use Neon-based rate limiting)
