# Infrastructure Security Findings Report

**Product:** CarbonSite — UK Construction Carbon Accounting Platform  
**Audit Date:** 2026-08-06  
**Auditor:** Automated code review + static analysis  
**Scope:** Data transport infrastructure, authentication/invite flows, multi-tenant project isolation

---

## Executive Summary

The platform has a well-structured security foundation: every org-scoped route calls `requireOrgMember()` before touching the database, all tenant-owned tables carry `organization_id` in every query, and storage keys are validated against an org-prefix convention. No cross-tenant data leak paths were found in code review. The invite and onboarding flow is robust with single-use tokens, expiry enforcement, and email enumeration resistance.

**Critical issues: 0**  
**High issues: 0**  
**Medium issues: 3**  
**Low issues: 4**  
**Informational: 2**

---

## Findings

### FIND-001 — In-memory rate limiter is instance-scoped

| Attribute | Value |
|-----------|-------|
| Severity | **Medium** |
| File | `lib/security/rate-limit.ts` |
| Affects | `/api/auth/accept-invite`, sign-in, invite creation |
| CVSS-like | AV:N / AC:H / PR:N / UI:N — Bypass requires routing to separate instance |

**Description**  
The rate limiter stores counters in a module-level `Map`. On any horizontally scaled deployment (Vercel serverless Functions, multiple Fly machines, or `pnpm worker` + Next.js on separate processes), each instance has an independent counter. An adversary who can influence routing (or simply triggers many requests that naturally fan across instances) can enumerate invite tokens or brute-force sign-in at a rate N× the configured limit, where N = number of active instances.

**Reproduction**  
1. Deploy with ≥2 serverless instances.  
2. Send 10 invalid accept-invite requests; alternate between two worker IPs.  
3. None triggers 429; the limit is logically split across both instances.

**Remediation**  
Replace the in-memory `store` with an Upstash Redis or Postgres-backed counter. The module is designed for this swap — the `rateLimit(key, limit, windowMs)` public API is stable. A Postgres advisory lock approach:

```sql
-- Postgres-based sliding window (add to a migrations):
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);
```

```typescript
// Drop-in replacement for rateLimit() using Prisma + raw SQL
async function rateLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const row = await prisma.$queryRaw<[{ count: number }]>`
    INSERT INTO rate_limit_buckets(key, count, reset_at)
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT(key) DO UPDATE
      SET count = CASE
            WHEN rate_limit_buckets.reset_at <= NOW() THEN 1
            ELSE rate_limit_buckets.count + 1
          END,
          reset_at = CASE
            WHEN rate_limit_buckets.reset_at <= NOW() THEN ${resetAt}
            ELSE rate_limit_buckets.reset_at
          END
    RETURNING count
  `;
  return row[0].count <= limit;
}
```

---

### FIND-002 — No rate limit on `/api/auth/token` (mobile refresh)

| Attribute | Value |
|-----------|-------|
| Severity | **Medium** |
| File | `app/api/auth/token/route.ts` |
| Affects | Field worker bearer token refresh |
| CVSS-like | AV:N / AC:L / PR:N / UI:N — unrestricted refresh attempts |

**Description**  
The `POLICIES.tokenRefresh` policy (60 req / 15 min) is defined in `lib/security/rate-limit.ts` but is never applied to the `/api/auth/token` endpoint. A broken or malicious mobile client can call this endpoint indefinitely, hammering the Postgres session table with `UPDATE` queries. An attacker who captures a valid Bearer token can also continuously roll it to maintain access indefinitely.

**Remediation**  
Add a rate-limit check at the top of the handler:

```typescript
import { rateLimitRequest, POLICIES } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  const limited = rateLimitRequest(req, { key: "token_refresh", ...POLICIES.tokenRefresh });
  if (limited) return limited;
  // ... rest of handler
}
```

---

### FIND-003 — 60-day session grace window after expiry

| Attribute | Value |
|-----------|-------|
| Severity | **Medium** |
| File | `app/api/auth/token/route.ts`, line 16 |
| Affects | Field worker mobile sessions |
| CVSS-like | AV:N / AC:H / PR:L / UI:N — requires a previously captured token |

**Description**  
`GRACE_MS = 60 × 24 × 60 × 60 × 1000` (60 days). A field worker session lasts 30 days; after it expires, the same session token can be used to mint a new one for up to 60 days more, giving a total effective lifetime of 90 days. If a device is lost or a token is compromised, revocation requires a manual database delete. There is no admin UI or API endpoint to revoke sessions.

**Remediation**  
- Reduce `GRACE_MS` to 7 days.  
- Add `DELETE /api/orgs/[orgId]/members/[memberId]/sessions` (admin only) that purges all `Session` rows for a given user.  
- Consider adding a session revocation list or short-lived refresh tokens for production.

---

### FIND-004 — Dev storage routes have no authentication

| Attribute | Value |
|-----------|-------|
| Severity | **Low** (dev-only) |
| File | `app/api/dev/storage/serve/route.ts`, `app/api/dev/storage/upload/route.ts` |
| Affects | Local development environment only |

**Description**  
Both dev storage routes are guarded only by `NODE_ENV !== "production" && STORAGE_DRIVER === "local"`. Any user who can reach the dev server (e.g. a shared staging environment with `NODE_ENV=development`) can read or write any storage key without credentials.

**Remediation**  
Add `requireSession()` to both dev routes. One line each:

```typescript
const session = await requireSession(); // add near top of handler
void session;
```

---

### FIND-005 — DB-driver storage HMAC uses a hardcoded fallback secret

| Attribute | Value |
|-----------|-------|
| Severity | **Low** |
| File | `lib/storage/signing.ts`, line 9 |
| Affects | Postgres-backed storage driver (`STORAGE_DRIVER=db`) |

**Description**  
`signStorageUrl()` falls back to `"carbonsite-dev-storage-secret"` when `BETTER_AUTH_SECRET` is unset. This string is public in the repository. Anyone who knows the string can forge valid presigned download or upload URLs for any storage key — bypassing the 15-minute expiry and the org-membership check in `/api/uploads/presign`.

**Remediation**  
Remove the fallback and throw at module load time if the secret is absent:

```typescript
function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET must be set");
  return s;
}
```

This matches the existing guard in `lib/auth/index.ts`.

---

### FIND-006 — `field_worker` exclusion from `ROLE_GROUPS.anyMember` is implicit

| Attribute | Value |
|-----------|-------|
| Severity | **Low** (informational risk) |
| File | `lib/auth/session.ts`, lines 88–93 |
| Affects | Dashboard, audit log, calculation endpoints |

**Description**  
`field_worker` is absent from `ROLE_GROUPS.anyMember`, which is the correct behaviour (field workers must not access dashboards or calculation data). However, this exclusion is silent — there is no comment explaining the intent. A future developer adding `field_worker` to `anyMember` to "fix a 403" would silently grant field workers access to all dashboard data across the org.

**Remediation**  
Add a comment:

```typescript
// IMPORTANT: field_worker is intentionally excluded. Field workers see only
// their own submissions via /field-submissions (own-only WHERE clause).
// Adding field_worker here would grant dashboard/calculation access — do not.
anyMember: [
  "admin", ...
```

---

### FIND-007 — Missing CSRF protection on cookie-based sessions

| Attribute | Value |
|-----------|-------|
| Severity | **Medium** |
| Affects | All browser-facing state-mutating routes when using cookie auth |

**Description**  
Better Auth issues `HttpOnly` cookies. No middleware exists to validate `Origin` or add `SameSite` enforcement beyond the default. While Better Auth itself sets `SameSite=Lax` by default on modern browsers, custom API routes (e.g. `POST /api/orgs/[orgId]/members`, `DELETE /api/orgs/[orgId]/invite-links/[id]`) could be triggered by a cross-site form submission if the `SameSite` attribute is not correctly propagated.

**Remediation**  
1. Confirm `BETTER_AUTH_SECRET` is set (required for secure cookie signing).  
2. Explicitly configure `session.cookieOptions = { sameSite: "lax" }` in `lib/auth/index.ts`.  
3. Add a `middleware.ts` at the root that validates `Origin` matches `TRUSTED_ORIGINS` on non-GET requests from browser clients.

---

### FIND-008 — `X-Forwarded-For` is trusted without proxy validation

| Attribute | Value |
|-----------|-------|
| Severity | **Low** |
| File | `lib/security/rate-limit.ts`, line 60 |
| Affects | All rate-limited endpoints |

**Description**  
The rate limiter uses the first value of `X-Forwarded-For` as the client IP. If the app is directly Internet-facing (e.g. during local development with ngrok, or misconfigured Vercel routing), an attacker can set this header to an arbitrary value and bypass per-IP rate limits.

**Remediation**  
On Vercel, use the `x-vercel-forwarded-for` header or trust only the last IP in `X-Forwarded-For`. On self-hosted deployments, configure a fixed trusted-proxy CIDR.

---

## Checklist Status

| Checklist Item | Status | Notes |
|----------------|--------|-------|
| All field-worker submission endpoints return 200/201 on valid data | ✅ Pass | Verified in code; covered by `field_worker.test.ts` |
| Invalid OCR payloads return 400 with clear error messages | ✅ Pass | Zod validation at route boundary; `handleRouteError` returns `{ code, message }` |
| Invite links expire after 24 hours (or configured time) | ✅ Pass | `expiresAt` check at `accept-invite` line 32; configurable 1–30 days |
| Magic-link tokens cannot be reused after acceptance | ✅ Pass | `usedAt` check at `accept-invite` line 36; single-use enforced |
| Cross-tenant API calls return 403/404 (never 200) | ✅ Pass | `requireOrgMember(orgId)` on every org-scoped route |
| Project IDs in URLs are validated against user's assigned projects | ✅ Pass | Site ownership verified; `fieldWorkerSiteAssignment` checked for field_workers |
| File uploads are stored under tenant/project prefixes | ✅ Pass | `org/{orgId}/...` enforced by `isValidStorageKey()` + `presignUpload` org check |
| Error messages do not leak other tenants' data or IDs | ✅ Pass | All 403/404s use generic codes; email enumeration resistance in invite flow |
| Rate limiting on invite acceptance | ⚠️ Partial | In-memory; bypassed in multi-instance deployments (FIND-001) |
| Rate limiting on mobile token refresh | ❌ Fail | Not applied (FIND-002) |

---

## Priority Remediation Order

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 | FIND-002 Rate limit on token refresh | 5 min — add 3 lines |
| 2 | FIND-005 Remove hardcoded storage secret | 5 min — remove fallback |
| 3 | FIND-007 CSRF / SameSite cookie config | 30 min — audit Better Auth config |
| 4 | FIND-006 Comment `field_worker` exclusion | 2 min — add comment |
| 5 | FIND-003 Reduce grace window + add session revoke endpoint | 2 hours |
| 6 | FIND-001 Distributed rate limiter | 4 hours — Postgres-backed counter |
| 7 | FIND-008 X-Forwarded-For proxy trust | Infra config — no code change required on Vercel |
| 8 | FIND-004 Dev storage auth | 10 min — add requireSession() |
