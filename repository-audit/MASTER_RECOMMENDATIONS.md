# Master Recommendations — Top 50 Highest-Value Improvements

_Ranked by: ROI × risk reduction × user impact ÷ implementation effort_

---

## Tier 1 — Immediate Action (Days 1–3)

### #1 — Fix Race Condition in accept-invite Transaction
**Files:** `app/api/auth/accept-invite/route.ts`  
**Effort:** 2 hours | **Risk Reduction:** Critical | **User Impact:** All field workers  
Move user + account creation inside `prisma.$transaction`. One concurrent double-tap can currently leave the database in a broken state with orphaned accounts. Easiest high-severity fix in the codebase.

### #2 — Add Database Indexes (7 tables)
**Files:** `prisma/schema.prisma`  
**Effort:** 2–3 hours | **Risk Reduction:** High | **User Impact:** Every API user  
Without indexes on `InviteLink.token`, `AuditLog(organizationId, createdAt)`, and `ActivityRecord(organizationId, reportingPeriodId, ...)`, the application will table-scan at scale. Add `@@index` directives and run migration. Zero code change — pure schema.

### #3 — Create Stub Pages for 5 Broken Sidebar Links
**Files:** 5 new page files  
**Effort:** 1 hour | **Risk Reduction:** Medium | **User Impact:** All web users  
Every user of the web app who clicks Records, Imports, Reports, Targets, or Calculations sees a Next.js 404. This is the single biggest UX issue in the current build.

### #4 — Add `.gitignore`
**Files:** `.gitignore` (new)  
**Effort:** 15 minutes | **Risk Reduction:** High | **User Impact:** Developers  
No `.gitignore` exists. Local evidence files (`uploads/`), `.env.local`, APK keystores, and generated files can be accidentally committed.

### #5 — Remove Unused npm Dependencies
**Files:** `package.json`  
**Effort:** 15 minutes | **Risk Reduction:** Low | **User Impact:** All web users (faster loads)  
Remove `motion`, `react-hook-form`, `@hookform/resolvers` — ~200 KB of production bundle for zero functionality.

### #6 — Replace `xlsx` 0.18.5 with `papaparse` + `exceljs`
**Files:** `package.json`  
**Effort:** 2–3 hours | **Risk Reduction:** High | **User Impact:** Import users  
`xlsx` 0.18.x is EOL with no security patches. Formula injection risk for CSV/Excel import. The import worker is still a stub, so migration cost is minimal.

### #7 — Remove `field_worker` from Facilities + Business Units GET
**Files:** `app/api/orgs/[orgId]/facilities/route.ts`, `business-units/route.ts`  
**Effort:** 30 minutes | **Risk Reduction:** High | **User Impact:** Field worker isolation  
Violates the stated architecture constraint. Field workers should not see org site structure.

---

## Tier 2 — This Sprint (Days 4–14)

### #8 — Add Security Headers via `next.config.ts`
**Effort:** 1–2 hours | **Risk Reduction:** Medium  
CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`. Currently zero HTTP security headers.

### #9 — Add `GET /api/health` Endpoint
**Effort:** 30 minutes | **Risk Reduction:** Medium  
Required for load balancers, uptime monitoring, deployment verification.

### #10 — Wire GoRouter `refreshListenable` to Riverpod Auth State
**Files:** `mobile/lib/core/router/router.dart`  
**Effort:** 3–4 hours | **Risk Reduction:** High | **User Impact:** All Flutter users  
Auth state changes (invite accept, 401 token expiry) currently do not trigger router re-evaluation. Users can appear stuck in wrong state until app restart.

### #11 — Fix Flutter API Base URL — Remove Runtime Storage Configuration
**Files:** `mobile/lib/core/api/client.dart`  
**Effort:** 1–2 hours | **Risk Reduction:** High  
Replace `_storage.read(key: 'api_base_url')` with `const String.fromEnvironment('API_BASE_URL')`. Eliminates phishing/MITM vector.

### #12 — Add Global Error Handler in Flutter main()
**Files:** `mobile/lib/main.dart`  
**Effort:** 1 hour | **Risk Reduction:** Medium | **User Impact:** All Flutter users  
Silent crashes in production leave no trace. Add `FlutterError.onError` and `PlatformDispatcher.instance.onError`.

### #13 — Extract Shared `FlutterSecureStorage` Singleton
**Files:** `mobile/lib/core/storage/secure_storage.dart` (new)  
**Effort:** 30 minutes | **Risk Reduction:** Low | **User Impact:** Security hardening  
Add `AndroidOptions(encryptedSharedPreferences: true)` — uses Jetpack Security instead of SharedPreferences for token storage.

### #14 — Add Rate Limiting on Auth + Presign Routes
**Effort:** 4–6 hours | **Risk Reduction:** High  
Sign-in brute force, invite token enumeration, presign storage abuse — all currently unlimited.

### #15 — Fix `writeAuditLog` Action for Org Creation
**Files:** `app/api/orgs/route.ts`, `lib/db/audit.ts`  
**Effort:** 15 minutes | **Risk Reduction:** Low  
Audit log entries for org creation are misclassified as `record.created`. Trivial fix, important for audit trail correctness.

---

## Tier 3 — Milestone 2 (Weeks 2–6)

### #16 — Implement Import Worker (CSV Parse → Stage → Error CSV)
**Files:** `workers/index.ts`  
**Effort:** 1–2 weeks | **User Impact:** All import users  
Core product function — without this, CSV imports silently succeed without parsing.

### #17 — Implement Field Submission API
**Files:** `app/api/orgs/[orgId]/field-submissions/` (new endpoints)  
**Effort:** 1 week | **User Impact:** All field workers  
`POST` (create from Flutter), `GET` (inbox for reviewer), `PATCH /review` (approve → ActivityRecord / reject).

### #18 — Implement Drift Offline Schema + Sync Service
**Files:** `mobile/lib/core/storage/database.dart` (new), `mobile/lib/features/sync/`  
**Effort:** 1–2 weeks | **User Impact:** All Flutter users on poor connectivity  
Core product requirement — field workers are on construction sites without reliable internet.

### #19 — Implement Camera + OCR Wiring in CaptureScreen
**Files:** `mobile/lib/features/capture/capture_screen.dart`  
**Effort:** 1 week | **User Impact:** All field workers  
Currently a stub. The OCR extractor exists and is tested — needs camera wiring.

### #20 — Complete OCR Extractor (supplierName, materialType, fuelType)
**Files:** `mobile/lib/features/capture/ocr_extractor.dart`  
**Effort:** 4–6 hours | **User Impact:** All field workers  
5 of 13 fields are always null. Fuel type not extracted on fuel receipts — a core document type.

### #21 — Implement PIN Lock Screen
**Files:** `mobile/lib/features/auth/pin_lock_screen.dart` (new)  
**Effort:** 4–8 hours | **User Impact:** All Flutter users (security)  
PIN is set up but never checked. Anyone with access to an unlocked device has full field worker access.

### #22 — Migrate Flutter Home Screen to Riverpod AsyncNotifier
**Files:** `mobile/lib/features/submissions/home_screen.dart`  
**Effort:** 2–4 hours | **User Impact:** Better UX (no repeated loading)  
Local setState for async data has no caching. Riverpod AsyncNotifier with `keepAlive` eliminates loading spinners on return navigation.

### #23 — Add Cursor-Based Pagination to All List Endpoints
**Effort:** 1 day | **User Impact:** Performance at scale  
Currently `take: 50` hardcoded in submissions. All list endpoints need cursor pagination per CLAUDE.md spec.

### #24 — Parallelize Org Layout Database Calls
**Files:** `app/(app)/orgs/[orgId]/layout.tsx:18`  
**Effort:** 30 minutes | **User Impact:** ~100ms faster page loads  
Three serial DB calls on every page load. Two of them (membership + org) are independent and can run with `Promise.all`.

---

## Tier 4 — Accessibility Pass (Weeks 4–6)

### #25 — Add Skip-to-Content Link (WCAG 2.4.1)
**Files:** `app/(app)/orgs/[orgId]/layout.tsx`  
**Effort:** 30 minutes | **User Impact:** Keyboard + screen reader users  
No bypass mechanism for the sidebar navigation. Every page load requires tabbing through 7 nav items.

### #26 — Add `aria-label` to `<nav>` and `aria-hidden` to Icons
**Files:** `components/org-sidebar.tsx`  
**Effort:** 30 minutes | **User Impact:** Screen reader users

### #27 — Add Per-Page `metadata` Exports
**Effort:** 2 hours | **User Impact:** Screen reader + SEO  
All pages show "CarbonSite" title. No page context announced on navigation.

### #28 — Fix Placeholder Text Contrast (`text-slate-400` → `text-slate-600`)
**Files:** `components/ui/input.tsx`  
**Effort:** 5 minutes | **User Impact:** Low-vision users  
`slate-400` fails WCAG 1.4.3 minimum contrast (2.5:1 vs required 4.5:1).

### #29 — Add `aria-describedby` Linking Inputs to Error Messages
**Effort:** 2 hours | **User Impact:** Screen reader users  
Error messages are announced as `role="alert"` but not linked to their input fields.

### #30 — Add `Semantics` Wrappers Throughout Flutter App
**Effort:** 1–2 days | **User Impact:** All users with TalkBack/VoiceOver  
Zero Semantics in Flutter codebase. Screen reader users cannot use any part of the app.

### #31 — Replace Hardcoded Font Sizes with `textTheme` in Flutter
**Effort:** 2–4 hours | **User Impact:** Users with accessibility font size settings  
Dynamic text scaling doesn't work with `fontSize: 26` hardcoded values.

---

## Tier 5 — Milestone 3: Calculation Engine (Weeks 7–10)

### #32 — Implement Calculation Worker
**Files:** `workers/index.ts`  
**Effort:** 1–2 weeks | **User Impact:** All calculation users  
Core product: normalize → select factor → compute CO2e → persist → rebuild DashboardAggregate.

### #33 — Push Factor Scoring into SQL
**Files:** `lib/calculation/factor-selector.ts`  
**Effort:** 2–4 hours | **User Impact:** Performance at scale  
Replace in-memory JS scoring loop with `ORDER BY CASE WHEN ... END LIMIT 1` SQL query.

### #34 — Add LRU Cache for Session/Membership Lookups
**Effort:** 3–4 hours | **User Impact:** ~50% reduction in auth DB queries  
Every API request makes 2 serial DB queries for auth. A 60-second LRU cache reduces this significantly for active sessions.

---

## Tier 6 — Observability & Operations (Ongoing)

### #35 — Add Structured Request Logging
**Effort:** 1 day | **Business Impact:** Production diagnostics  
Add `request_id`, `org_id`, `user_id`, `duration_ms` to every API request log.

### #36 — Add Sentry Error Tracking (Web + Flutter)
**Effort:** 2–4 hours | **Business Impact:** Production crash visibility  
Zero error tracking currently.

### #37 — Add pg-boss Dead-Letter Alerting
**Effort:** 2 hours | **Business Impact:** Silent job failures become visible  
pg-boss `error` event logged but not alerted. Failed jobs after retries are silently dropped.

### #38 — Add Worker SIGTERM Graceful Shutdown
**Files:** `workers/index.ts`  
**Effort:** 1 hour | **Business Impact:** Clean deployments  
`SIGTERM` currently kills the worker mid-job.

---

## Tier 7 — Milestone 4–5: Dashboards, Reports, Production

### #39 — Implement Notification Worker (Resend + FCM)
**Files:** `workers/index.ts`  
**Effort:** 1 week | **User Impact:** Review cycle efficiency

### #40 — Implement Report Worker (Puppeteer PDF)
**Files:** `workers/index.ts`  
**Effort:** 1 week | **User Impact:** Compliance + reporting

### #41 — Add Deployment Configuration (Vercel/Fly)
**Effort:** 1 day | **Business Impact:** Production launch  
No deployment config exists.

### #42 — Add Prisma Migrate Deploy to CI
**Files:** `.github/workflows/ci.yml`  
**Effort:** 30 minutes | **Business Impact:** Deployment safety  
Migrations are never run in CI.

### #43 — Pin Flutter Version in CI
**Files:** `.github/workflows/ci.yml`  
**Effort:** 5 minutes | **Risk Reduction:** Build stability  
`flutter-version: "3.x"` would silently break on Flutter 4 release.

### #44 — Add Renovate Bot / Dependabot
**Effort:** 30 minutes | **Risk Reduction:** Continuous security  
Zero automated dependency monitoring.

---

## Tier 8 — Long-Term Improvements

### #45 — Add PgBouncer Connection Pooling
**Effort:** 1 day | **Business Impact:** Scalability  
Current: unbounded connections per Next.js instance. At 100 concurrent users this exhausts Postgres connection limits.

### #46 — Add `prefers-reduced-motion` Guards
**Effort:** 2–4 hours | **User Impact:** Photosensitive users  
No reduced motion support anywhere.

### #47 — Add Dark Mode Support
**Effort:** 2–3 days | **User Impact:** ~30% of users  
Hardcoded colors throughout. Requires CSS custom property migration.

### #48 — EWC Code Regex Context-Awareness
**Files:** `mobile/lib/features/capture/ocr_extractor.dart`  
**Effort:** 2 hours | **User Impact:** OCR accuracy  
Current regex has false positives on invoice numbers and reference codes.

### #49 — Add Integration Tests: Import → Calculate → Dashboard Pipeline
**Effort:** 1–2 weeks | **Risk Reduction:** Regression prevention  
Zero integration tests. The most important trust invariant (report totals match dashboard totals for same snapshot) has no automated verification.

### #50 — Add Flutter Build Flavors (dev/staging/prod)
**Effort:** 1 day | **Risk Reduction:** Environment safety  
No build flavors. Dev, staging, and production all use the same binary configuration.

---

## Summary by ROI Category

| Category | Items | Total Effort | Expected Return |
|---|---|---|---|
| Security fixes | #1, #3, #6, #7, #8, #11, #13, #14, #21 | 2–3 days | Eliminates auth race, data exposure, EOL vuln |
| Broken functionality | #3, #16, #17, #18, #19, #32, #39, #40 | 8–12 weeks | Product actually works end-to-end |
| Performance | #2, #23, #24, #33, #34, #45 | 1–2 days | Sub-100ms queries; sub-3s dashboards |
| Accessibility | #25–#31 | 1–2 weeks | WCAG 2.1 AA compliance; screen reader support |
| Developer experience | #4, #5, #15, #35, #36, #41–#44 | 1–2 days | Visible failures; automated updates |
| Quality / UX | #12, #22, #38, #46, #47 | 1–2 weeks | Stability, accessibility, dark mode |
