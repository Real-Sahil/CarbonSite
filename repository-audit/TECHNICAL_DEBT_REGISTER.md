# Technical Debt Register — CarbonSite

_Prioritized backlog of debt items, ordered by impact × urgency._

---

## P0 — Critical (Block Production or Core Features)

### TD-001: All Four Background Workers Are Stubs
- **File:** `workers/index.ts`
- **Impact:** Imports, calculations, reports, and notifications are silent no-ops. The entire data pipeline does not function.
- **Risk:** Data loss — jobs are enqueued, picked up, "completed", and discarded with no error
- **Effort:** Large (3–4 weeks for full implementation across Milestone 2–5)
- **Fix:** Implement workers one by one: imports first (CSV parse + stage + error CSV), then calculations, then reports, then notifications

---

### TD-002: Race Condition in accept-invite Transaction
- **File:** `app/api/auth/accept-invite/route.ts:40`
- **Impact:** Concurrent requests from the same invite link can create orphaned User/Account rows or crash with unique constraint violation
- **Risk:** Auth breakage for field workers on slow mobile connections who double-tap "Join"
- **Effort:** Small (1–2 hours — move user/account creation inside existing `$transaction`)
- **Fix:** Consolidate all DB writes into the `prisma.$transaction` block

---

### TD-003: No Database Indexes Defined
- **File:** `prisma/schema.prisma`
- **Impact:** Table scans on every org-scoped query; production performance will degrade linearly with data volume
- **Risk:** Dashboard load > 30s at 10k records; invite acceptance visible latency
- **Effort:** Small (2–3 hours — add `@@index` directives, run migration)
- **Fix:** Add indexes per PERFORMANCE_AUDIT.md recommendations

---

### TD-004: Five Sidebar Nav Links Point to Non-Existent Pages (404)
- **File:** `components/org-sidebar.tsx`
- **Impact:** Users clicking Records, Imports, Reports, Targets, Calculations get a Next.js 404 error page
- **Risk:** Confusing UX; looks like a broken product
- **Effort:** Small (1 hour — add 5 stub pages with "Coming soon" content)
- **Fix:** Create placeholder pages for `/records`, `/imports`, `/reports`, `/targets`, `/calculations`

---

## P1 — High (Affects Core Security or Product Integrity)

### TD-005: No Rate Limiting on Any Endpoint
- **File:** All API routes
- **Impact:** Auth endpoints open to brute-force; presign endpoint open to storage abuse
- **Risk:** Account enumeration, DoS via job queue flood
- **Effort:** Medium (4–6 hours — add middleware with Upstash or postgres-based counter)
- **Fix:** Add Next.js middleware with rate limiting on `/api/auth/*` and `/api/uploads/*`

---

### TD-006: `field_worker` Can Access All Org Facilities and Reporting Periods
- **Files:** `app/api/orgs/[orgId]/facilities/route.ts:14`, `app/api/orgs/[orgId]/business-units/route.ts:14`
- **Impact:** Violates the stated architecture isolation requirement for field workers
- **Risk:** Data exposure — field workers see internal org site structure
- **Effort:** Tiny (30 minutes — remove `field_worker` from allowed roles in two routes)
- **Fix:** Remove `"field_worker"` from `requireOrgMember` in `/facilities` GET and `/business-units` GET

---

### TD-007: `xlsx` 0.18.5 Is EOL with No Security Patches
- **File:** `package.json`
- **Impact:** Import pipeline uses an unpatched library vulnerable to formula injection
- **Risk:** Malicious CSV/Excel file could exploit unpatched vulnerabilities
- **Effort:** Medium (4–8 hours — replace library and update import worker implementation)
- **Fix:** `pnpm remove xlsx && pnpm add papaparse exceljs`

---

### TD-008: No `.gitignore` File
- **Impact:** `uploads/` directory (local dev evidence files), `.env.local`, and generated files could be accidentally committed
- **Risk:** Secret leakage, large binary files in git history
- **Effort:** Tiny (15 minutes)
- **Fix:** Create `.gitignore` with standard Next.js + Flutter + environment file patterns

---

### TD-009: Flutter Drift Schema and Sync Service Not Implemented
- **Impact:** Flutter app has zero offline capability; all submissions require live network
- **Risk:** Core use case fails at construction sites with poor connectivity — which is the primary use case
- **Effort:** Large (1–2 weeks — implement drift schema, sync isolate, connectivity monitoring)
- **Fix:** Implement per Milestone 2 plan: `AppDatabase`, `SubmissionDraft`, sync service

---

### TD-010: Flutter Router Has No `refreshListenable`
- **File:** `mobile/lib/core/router/router.dart:18`
- **Impact:** Auth state changes (token written, token cleared) do not trigger router re-evaluation
- **Risk:** App appears logged in after server-side session revocation; or appears logged out after token write without app restart
- **Effort:** Small (2–4 hours — wire Riverpod notifier to GoRouter refreshListenable)
- **Fix:** Implement `GoRouterRefreshStream` or `ChangeNotifier` backed by auth state provider

---

## P2 — Medium (Affects Quality, Maintainability, or UX)

### TD-011: PIN Is Stored but Never Verified
- **File:** `mobile/lib/features/auth/pin_setup_screen.dart`
- **Impact:** PIN setup is cosmetic — there is no lock screen, no re-authentication
- **Risk:** Anyone who picks up an unlocked device has full field worker access
- **Effort:** Medium (4–8 hours — implement lock screen, PIN verification on cold start)
- **Fix:** Add a `PinLockScreen` shown on app resume if more than 5 minutes have elapsed

---

### TD-012: No Error Boundary in Flutter App
- **File:** `mobile/lib/main.dart`
- **Impact:** Unhandled exceptions silently crash the app in release mode
- **Risk:** User data loss; no way to diagnose production crashes
- **Effort:** Small (1–2 hours — add FlutterError.onError + PlatformDispatcher.onError hooks)
- **Fix:** Add global error handlers in `main()` with Sentry or at minimum a local crash log

---

### TD-013: Unused npm Dependencies Bloating Bundle
- **Files:** `package.json`
- **Impact:** `motion` + `react-hook-form` + `@hookform/resolvers` add ~200 KB to production bundle
- **Risk:** Slower load times; increased attack surface
- **Effort:** Tiny (10 minutes)
- **Fix:** `pnpm remove motion react-hook-form @hookform/resolvers`

---

### TD-014: No HTTP Security Headers
- **Impact:** Missing CSP, X-Frame-Options, X-Content-Type-Options
- **Risk:** Clickjacking, MIME sniffing attacks
- **Effort:** Small (1–2 hours — add `next.config.ts` with headers())
- **Fix:** Add security headers in Next.js config

---

### TD-015: OCR Extractor Incomplete — 5 of 13 Fields Always Null
- **File:** `mobile/lib/features/capture/ocr_extractor.dart`
- **Impact:** Supplier name, material type, fuel type, quantity never pre-filled in submission form
- **Risk:** Field workers must manually enter all data — increases time and error rate
- **Effort:** Medium (4–6 hours — add regex patterns for missing fields)
- **Fix:** Implement extraction patterns for `supplierName`, `materialType`, `fuelType`, `quantity`

---

### TD-016: `FlutterSecureStorage` Duplicated in Two Files
- **Files:** `mobile/lib/core/api/client.dart`, `mobile/lib/core/api/endpoints.dart`
- **Impact:** Code duplication; inconsistent options (no `AndroidOptions` set)
- **Risk:** Low — but missing Android encryption option on secure storage
- **Effort:** Tiny (30 minutes)
- **Fix:** Extract singleton with `AndroidOptions(encryptedSharedPreferences: true)`

---

### TD-017: API Base URL Configurable from Runtime Storage in Flutter
- **File:** `mobile/lib/core/api/client.dart:35`
- **Impact:** Security and consistency risk (see SECURITY_AUDIT S05)
- **Risk:** Redirect of API calls to attacker-controlled server
- **Effort:** Small (1–2 hours — replace with `--dart-define` compile-time constant)
- **Fix:** Use `const String.fromEnvironment('API_BASE_URL')` with build flavor configuration

---

### TD-018: No Observability or Structured Logging
- **Impact:** Zero visibility into production errors, slow queries, or job failures
- **Risk:** Silent failures undetectable until users complain
- **Effort:** Medium (1–2 days — add structured logger, Sentry or Axiom integration)
- **Fix:** Add `pino` or similar structured logger; add Sentry DSN; instrument all routes with request_id

---

### TD-019: No Health Check Endpoint
- **Impact:** No way for load balancers or uptime monitors to verify the app is live
- **Risk:** Deploy failures go undetected
- **Effort:** Tiny (30 minutes)
- **Fix:** Add `app/api/health/route.ts` returning `{ status: "ok", timestamp: ... }`

---

## P3 — Low (Technical Hygiene)

### TD-020: `writeAuditLog` Uses Wrong Action for Org Creation
- **File:** `app/api/orgs/route.ts:33`
- **Impact:** Audit log entries for org creation are misclassified as `record.created`
- **Effort:** Tiny (15 minutes — add `"org.created"` to AuditAction union and use it)

### TD-021: No `next.config.ts` Exists
- **Impact:** No way to set redirects, rewrites, security headers, or image domains
- **Effort:** Tiny (30 minutes — create file and add security headers)

### TD-022: CI Flutter Job Uses `flutter-version: "3.x"` Without Pinning
- **File:** `.github/workflows/ci.yml`
- **Impact:** Flutter 4.x would silently break the build if released
- **Effort:** Tiny (5 minutes — pin to specific stable version)

### TD-023: `inviteLink.token` Not in Structured Database Query Index
- Already covered by TD-003; flagged separately because it affects every invite acceptance

### TD-024: EWC Code Regex Has False Positive Risk
- **File:** `mobile/lib/features/capture/ocr_extractor.dart:25`
- **Impact:** Invoice numbers, reference codes incorrectly classified as EWC codes
- **Effort:** Small (1–2 hours — add context-aware prefix matching)

---

## Debt Summary

| Priority | Count | Total Estimated Effort |
|---|---|---|
| P0 Critical | 4 | 4–5 weeks |
| P1 High | 6 | 2–4 weeks |
| P2 Medium | 9 | 4–6 weeks |
| P3 Low | 5 | < 1 week |
| **Total** | **24** | **~12 weeks** |

Note: The majority of P0/P1 effort is milestone feature implementation (workers, offline), not technical debt in the traditional sense. True debt (misclassified audit log, missing indexes, race condition) can be cleared in 1–2 days.
