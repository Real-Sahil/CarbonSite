# Implementation Roadmap — CarbonSite

---

## Overview

This roadmap extends the existing milestone plan with the specific fixes identified in this audit. Audit items are woven into each phase rather than deferred to a separate "cleanup sprint".

---

## Phase 1 — Critical Fixes (1–2 Weeks)

**Goal:** Eliminate security vulnerabilities, broken navigation, and silent data loss before Milestone 2 work begins.

### 1.1 Security & Correctness (Days 1–2)

| Task | File(s) | Effort | Audit Ref |
|---|---|---|---|
| Fix accept-invite race condition — consolidate user/account/membership into single transaction | `app/api/auth/accept-invite/route.ts` | 2h | TD-002, S01 |
| Remove `field_worker` from facilities + business-units GET | `app/api/orgs/[orgId]/facilities/route.ts`, `business-units/route.ts` | 30m | TD-006, S03 |
| Add `.gitignore` (env files, uploads/, *.jks, .next/) | `.gitignore` | 15m | TD-008 |
| Fix `writeAuditLog` action for org creation | `app/api/orgs/route.ts`, `lib/db/audit.ts` | 15m | TD-020 |

### 1.2 Database Indexes (Day 2)

| Task | File(s) | Effort | Audit Ref |
|---|---|---|---|
| Add `@@index` for InviteLink.token, AuditLog, ActivityRecord, FieldSubmission, EmissionCalculation, Session | `prisma/schema.prisma` | 2h | TD-003, PERF |
| Run `pnpm prisma migrate dev` to apply indexes | — | 30m | — |

### 1.3 Navigation & UX (Day 3)

| Task | File(s) | Effort | Audit Ref |
|---|---|---|---|
| Create stub pages: records, imports, reports, targets, calculations | `app/(app)/orgs/[orgId]/*/page.tsx` (5 files) | 1h | TD-004 |
| Add `next.config.ts` with security headers and health endpoint | `next.config.ts`, `app/api/health/route.ts` | 2h | TD-014, TD-021 |

### 1.4 Dependency Cleanup (Day 4)

| Task | File(s) | Effort | Audit Ref |
|---|---|---|---|
| Remove unused deps: motion, react-hook-form, @hookform/resolvers | `package.json` | 15m | TD-013 |
| Replace xlsx with papaparse + exceljs | `package.json` | 2h | TD-007, S04 |

### 1.5 Flutter Structural Fixes (Days 5–7)

| Task | File(s) | Effort | Audit Ref |
|---|---|---|---|
| Extract shared `FlutterSecureStorage` singleton with Android encryption options | `mobile/lib/core/storage/secure_storage.dart` | 30m | TD-016 |
| Replace runtime API base URL with compile-time constant | `mobile/lib/core/api/client.dart` | 1h | TD-017, S05 |
| Add global error handlers in main() | `mobile/lib/main.dart` | 1h | TD-012 |
| Wire Riverpod auth state to GoRouter `refreshListenable` | `mobile/lib/core/router/router.dart` | 3h | TD-010 |
| Add `Semantics` labels to PIN pad and invite form | `mobile/lib/features/auth/pin_setup_screen.dart`, `invite_screen.dart` | 2h | ACCSS |

**Phase 1 Deliverables:**
- Zero broken navigation links
- Race condition fixed
- Security headers deployed
- Flutter auth state is reactive
- All indexes applied

---

## Phase 2 — Milestone 2: Field Capture & Data Intake (3–4 Weeks)

This is the core Milestone 2 implementation with audit fixes integrated.

### 2.1 Field Submission API (Week 1)

| Task | Notes |
|---|---|
| `POST /api/orgs/[orgId]/field-submissions` | Create FieldSubmission from field worker; validate role; require `field_worker` only |
| `GET /api/orgs/[orgId]/field-submissions` | List for org reviewer + filtered by submittedByMe for field workers |
| `PATCH /api/orgs/[orgId]/field-submissions/[id]/review` | Approve (→ ActivityRecord) or reject; send notification |
| Rate limiting middleware on auth + presign + submissions routes | Fix TD-005 |

### 2.2 Import Pipeline (Week 1–2)

| Task | Notes |
|---|---|
| Implement `imports` worker: parse CSV with papaparse, validate headers, create StagedActivityRecord rows | Replace xlsx first (Phase 1) |
| `POST /api/orgs/[orgId]/imports` — upload CSV, presign source file, enqueue job | |
| `POST /api/orgs/[orgId]/imports/[id]/commit` — promote staged rows to ActivityRecord | |
| Import list page at `/orgs/[orgId]/imports` | Replace stub page |
| Error CSV: rows that fail validation → write errors.csv to R2 | |

### 2.3 Activity Records (Week 2)

| Task | Notes |
|---|---|
| `GET /api/orgs/[orgId]/activity-records` — paginated with cursor | Implement cursor pagination as per CLAUDE.md |
| `POST /api/orgs/[orgId]/activity-records` — manual record creation | |
| Records list page at `/orgs/[orgId]/records` | Replace stub page |

### 2.4 Flutter Capture Flow (Weeks 2–4)

| Task | Notes |
|---|---|
| Drift database schema: `SubmissionDraft`, `SyncQueueEntry` tables | Fix TD-009 |
| Sync service: `connectivity_plus` + background isolate | Fix TD-009 |
| `CaptureScreen`: camera + live ML Kit overlay | Implement stub |
| Wire `OcrExtractor.extract()` to pre-fill submission form | |
| Complete OCR extractor: supplierName, materialType, fuelType | Fix TD-015 |
| GPS auto-tag via `geolocator` | |
| Submission status list in `SubmissionsScreen` | Implement stub |
| PIN lock screen with re-authentication | Fix TD-011 |
| Migrate home screen to Riverpod `AsyncNotifier` | Fix TD-010 Flutter data pattern |

### 2.5 Accessibility Pass (Week 4)

| Task | Notes |
|---|---|
| Web: skip-to-content link | Fix WCAG 2.4.1 |
| Web: `aria-label` on `<nav>` + icon `aria-hidden` | Fix landmark + noise |
| Web: placeholder color to `text-slate-500` | Fix contrast fail |
| Web: per-page metadata (`generateMetadata`) | Fix WCAG 2.4.2 |
| Web: `aria-describedby` linking inputs to error messages | Fix SC 3.3.1 |
| Flutter: `Semantics` wrappers on all interactive elements | Fix accessibility gap |
| Flutter: replace hardcoded font sizes with `textTheme` | Fix dynamic text scaling |

**Phase 2 Deliverables:**
- Field workers can submit evidence from Flutter app
- CSV import pipeline functional end-to-end
- Offline submission queue working
- Accessibility issues resolved

---

## Phase 3 — Milestone 3: Calculation Engine + Performance (3–4 Weeks)

### 3.1 Calculation Engine UI (Weeks 1–2)

| Task | Notes |
|---|---|
| Implement `calculations` worker: normalizeUnit → selectFactor → computeCo2e → persist EmissionCalculation rows | |
| Rebuild DashboardAggregate after each calculation run | |
| `POST /api/orgs/[orgId]/calculation-runs` | Enqueue run |
| `GET /api/orgs/[orgId]/calculation-runs/[id]` | Poll status |
| Calculation trigger page at `/orgs/[orgId]/calculations` | Replace stub page |
| Per-record calculation explanation modal | |

### 3.2 Performance Optimization (Week 3)

| Task | Notes |
|---|---|
| Add LRU cache for `(sessionToken, orgId)` → membership in `requireOrgMember` | Fix PERF recommendation |
| Move factor scoring from JS into SQL (`ORDER BY CASE WHEN ... END LIMIT 1`) | Fix in-memory scoring |
| Add cursor-based pagination to all list endpoints | Replace `take: 50` hardcodes |
| Parallelize org layout DB calls | Fix serial queries in layout |

### 3.3 Observability (Week 4)

| Task | Notes |
|---|---|
| Add structured request logging middleware (`request_id`, `org_id`, `duration_ms`) | Fix TD-018 |
| Add Sentry error tracking (web + Flutter) | Fix TD-012 |
| Add pg-boss job metrics (start time, duration, retry count) | |
| Add worker health check (last successful job time) | |

**Phase 3 Deliverables:**
- Calculation pipeline fully functional
- Dashboard shows real data from DashboardAggregate
- Sub-100ms auth + list query times with indexes + cache
- Production error tracking enabled

---

## Phase 4 — Milestone 4: Dashboards, Review & Notifications (2–3 Weeks)

### 4.1 Dashboard (Week 1)

| Task | Notes |
|---|---|
| `GET /api/orgs/[orgId]/dashboard` — read DashboardAggregate | |
| Dashboard page with Recharts/Tremor scope breakdown + category breakdown | |
| Data quality panel (missing evidence, outliers) | |
| Period-over-period comparison | |

### 4.2 Review Tasks & Notifications (Week 2)

| Task | Notes |
|---|---|
| Implement `notifications` worker: Resend email + FCM push | Fix worker stub |
| Review task queue: assign reviewer, approve/reject records | |
| Comment threads on records | |
| Flutter push notification handling (`firebase_messaging`) | |
| Flutter: deep link from notification → submission detail | |

### 4.3 Full Accessibility Audit (Week 3)

| Task | Notes |
|---|---|
| WCAG 2.1 AA formal review of all implemented features | |
| Colour contrast audit with automated tooling (axe-core) | |
| Keyboard navigation full test | |
| Screen reader test with NVDA/VoiceOver | |
| Flutter TalkBack/VoiceOver test | |
| Add `prefers-reduced-motion` media query guards | |

**Phase 4 Deliverables:**
- Live dashboard with real aggregated data
- Email + push notifications working
- Full WCAG 2.1 AA compliance for web
- Flutter screen reader usability verified

---

## Phase 5 — Milestone 5: Reporting, Scalability & Production Readiness

### 5.1 Reporting Pipeline (Weeks 1–2)

| Task | Notes |
|---|---|
| `POST /api/orgs/[orgId]/snapshots` — publish immutable snapshot | |
| `POST /api/orgs/[orgId]/reports` — trigger Puppeteer PDF + CSV generation | |
| Implement `reports` worker: Puppeteer PDF from snapshot → upload to R2 with checksum | Fix worker stub |
| Reports page with version history + download links | Replace stub page |
| Targets + initiatives page | Replace stub page |

### 5.2 Scalability Preparation (Week 3)

| Task | Notes |
|---|---|
| Add PgBouncer connection pooling (or Neon pooled connection string) | |
| Worker process: add SIGTERM handler and graceful shutdown | |
| Add Postgres dead-letter queue alerting (pg-boss `failed` event) | |
| Load test: import 25k rows, calculate 100k records, verify < 3s dashboard | |
| Add `export const dynamic = 'force-static'` to static pages | |

### 5.3 Deployment Configuration

| Task | Notes |
|---|---|
| Add deployment config (Vercel/Fly.io `fly.toml` or Vercel `vercel.json`) | |
| Separate worker deployment with health monitoring + auto-restart | |
| CI/CD: add Prisma migrate deploy step before web deploy | |
| Add Renovate Bot or Dependabot for automated dependency PRs | |
| Security headers review + CSP configuration | |
| Flutter: production build flavors (`dev`, `staging`, `prod`) | |
| Android APK/AAB signing workflow (GitHub Actions) | Already documented |

**Phase 5 Deliverables:**
- Full product functional end-to-end
- Production deployment configured
- Load-tested against stated constraints
- Dependency updates automated

---

## Effort Summary

| Phase | Duration | Business Impact |
|---|---|---|
| Phase 1 — Critical Fixes | 1–2 weeks | Eliminates security gaps, broken UX, silent data loss |
| Phase 2 — Field Capture & Import | 3–4 weeks | Core field worker workflow; first real data flowing |
| Phase 3 — Calculation Engine | 3–4 weeks | First calculated GHG inventory; first measurable output |
| Phase 4 — Dashboards & Notifications | 2–3 weeks | Sustainability manager can see and act on data |
| Phase 5 — Reports & Production | 2–3 weeks | Publishable audit report; production-ready deployment |
| **Total** | **11–16 weeks** | **Full MVP** |
