# Executive Summary — CarbonSite Repository Audit

**Date:** 2026-06-11  
**Auditor:** Principal Architect / Security / Accessibility / Flutter Specialist  
**Scope:** Full monorepo — Next.js 16 web app, Flutter mobile app, Prisma schema, CI/CD, infrastructure

---

## Scorecard

| Dimension | Score | Trend |
|---|---|---|
| **Overall Architecture** | 71 / 100 | ↑ Strong foundation, milestones 2–5 unbuilt |
| **Security** | 62 / 100 | ↑ Core guards solid; rate limiting, token security, race conditions need fixes |
| **Performance** | 58 / 100 | → Calculation engine designed for scale; no query indexes visible; no caching; no pagination on most lists |
| **Accessibility** | 38 / 100 | ↓ Web has partial WCAG 2.1 AA; Flutter has zero Semantics; no skip links |
| **Scalability** | 64 / 100 | ↑ pg-boss avoids Redis; DashboardAggregate pattern is correct; missing indexes will bite at 50k+ rows |
| **Maintainability** | 67 / 100 | ↑ Consistent patterns; 70%+ of product features are TODO stubs |

---

## Top Risks

### Critical
1. **Race condition in accept-invite** — User creation (`prisma.user.create`) and credential account creation happen outside the main transaction. Concurrent identical requests can produce orphaned Account rows or crash the worker. (`app/api/auth/accept-invite/route.ts`)
2. **All four background workers are stubs** — `workers/index.ts` logs job data and does nothing else. Imports, calculations, reports, and notifications silently succeed without executing any business logic.
3. **No database indexes defined** — Queries on `(organizationId, createdAt)`, `(organizationId, reportingPeriodId)`, and `inviteLink.token` have no explicit index in `prisma/schema.prisma`. At 10k+ rows these queries will table-scan.

### High
4. **Invite token entropy** — Tokens are raw `crypto.randomUUID()` (128-bit UUID v4). Acceptable but not HMAC-signed; a compromised token cannot be invalidated server-side without scanning the table.
5. **`field_worker` can list all org facilities and reporting-periods** — The GET handlers for `/facilities` and `/reporting-periods` explicitly allow `field_worker`. This exposes org structure data that the architecture doc says must be restricted to "zero access to org aggregate data".
6. **No rate limiting anywhere** — Auth endpoints, presign endpoint, and invite-accept are open to brute-force and enumeration at any request rate.
7. **Flutter: no auth state reactivity** — GoRouter's `redirect` callback reads `flutter_secure_storage` once at boot. Token expiry or server-side session revocation will not trigger re-navigation until the app is restarted.

### Medium
8. **`xlsx` (0.18.5) is EOL** — SheetJS relicensed and stopped publishing OSS security patches for 0.18.x. Any CSV/Excel parsing in production uses an unpatched library.
9. **`motion` and `@hookform/resolvers` are installed but unused** — Unused production dependencies increase bundle size and attack surface.
10. **Flutter Dio client singleton is not thread-safe** — `getClient()` can create multiple instances under concurrent invocation; the singleton guard (`if (_client != null)`) is not guarded with a lock.

---

## Quick Wins (< 1 day each)

1. Add `@@index` directives to `schema.prisma` for the 4 highest-frequency queries
2. Move user + account creation into the existing `prisma.$transaction` in `accept-invite`
3. Remove `motion` and `@hookform/resolvers` from `package.json` (unused)
4. Block `field_worker` from `/facilities` and `/reporting-periods` GET endpoints
5. Add a `NEXT_PUBLIC_APP_URL` fallback guard to the invite-link generator so URLs don't silently produce `undefined/invite/...`
6. Add `aria-label` to the sidebar `<nav>` element and add a "Skip to main content" link
7. Add `Semantics` wrappers to PIN dots and number pad in `pin_setup_screen.dart`
8. Replace the `inviteLink.token` lookup with an indexed field (add `@@index([token])` to schema)
9. Add `@index` on `AuditLog(organizationId, createdAt)`
10. Add the `uploads/` directory to `.gitignore`

---

## Recommended Priorities

### Immediate (this sprint)
- Complete all four worker implementations (the product cannot function without them)
- Fix race condition in accept-invite transaction
- Add database indexes
- Block field_worker from sensitive org-aggregate routes

### Next Sprint
- Implement Milestone 2 (field submissions API, import pipeline, Flutter capture flow)
- Add rate limiting (middleware on auth + presign routes)
- Replace `xlsx` with a maintained alternative (`exceljs` or `papaparse`)
- Add Flutter `GoRouterRefreshStream` for reactive auth state

### Medium Term
- Full accessibility pass (WCAG 2.1 AA) — web + Flutter
- Add observability (structured request logs, job metrics)
- Integration test suite covering import → calculation → dashboard pipeline
- Deployment configuration (Dockerfile or platform config)
