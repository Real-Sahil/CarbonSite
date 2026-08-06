# CarbonSite API Security Audit

**Date:** 2026-08-06  
**Scope:** Authentication/invite flows, field-worker submission transport, multi-tenant isolation  
**Branch:** `claude/carbon-accounting-security-audit-uxsm68`

---

## 1. Endpoint Inventory

### Auth & Identity (unauthenticated)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/auth/[...all]` | None | Better Auth catch-all (sign-in, sign-up, reset-password) |
| `POST` | `/api/auth/accept-invite` | None | Accept invite by token → creates session |
| `POST` | `/api/auth/token` | Bearer token | Mobile session refresh |
| `GET`  | `/api/health` | None | Liveness probe |

### Field Worker Submission Transport

| Method | Path | Auth required | Roles |
|--------|------|--------------|-------|
| `GET`  | `/api/orgs/[orgId]/field-submissions` | ✅ | admin, editor, reviewer, field_worker |
| `POST` | `/api/orgs/[orgId]/field-submissions` | ✅ | admin, editor, reviewer, field_worker |
| `GET`  | `/api/orgs/[orgId]/field-submissions/[submissionId]` | ✅ | admin, editor, reviewer, viewer, auditor, field_worker |
| `PATCH`| `/api/orgs/[orgId]/field-submissions/[submissionId]/review` | ✅ | admin, editor, reviewer |
| `PATCH`| `/api/orgs/[orgId]/field-submissions/bulk-review` | ✅ | admin, editor, reviewer |
| `POST` | `/api/orgs/[orgId]/field-submissions/[submissionId]/resubmit` | ✅ | field_worker |
| `GET`/`POST` | `/api/orgs/[orgId]/field-submissions/[submissionId]/comments` | ✅ | admin, editor, reviewer, auditor |
| `GET`  | `/api/orgs/[orgId]/my-sites` | ✅ | admin, editor, reviewer, field_worker |

### Invite & Onboarding

| Method | Path | Auth required | Roles |
|--------|------|--------------|-------|
| `POST` | `/api/auth/accept-invite` | None | — |
| `GET`  | `/api/orgs/[orgId]/invite-links` | ✅ | admin |
| `POST` | `/api/orgs/[orgId]/invite-links` | ✅ | admin |
| `DELETE`| `/api/orgs/[orgId]/invite-links/[inviteLinkId]` | ✅ | admin |
| `GET`  | `/api/orgs/[orgId]/members` | ✅ | admin, editor, reviewer, viewer, auditor |
| `POST` | `/api/orgs/[orgId]/members` | ✅ | admin |
| `GET`/`PATCH`/`DELETE` | `/api/orgs/[orgId]/members/[memberId]` | ✅ | admin |

### Field Worker Site Assignments

| Method | Path | Auth required | Roles |
|--------|------|--------------|-------|
| `GET`  | `/api/orgs/[orgId]/field-worker-site-assignments` | ✅ | admin, editor, reviewer, viewer, auditor |
| `POST` | `/api/orgs/[orgId]/field-worker-site-assignments` | ✅ | admin, editor |
| `DELETE`| `/api/orgs/[orgId]/field-worker-site-assignments/[assignmentId]` | ✅ | admin, editor |

### Tenant-Scoped Admin Endpoints

| Group | Path prefix | Auth |
|-------|-------------|------|
| Org CRUD | `/api/orgs/[orgId]` | requireOrgMember per route |
| Activity Records | `/api/orgs/[orgId]/activity-records/...` | requireOrgMember |
| Imports | `/api/orgs/[orgId]/imports/...` | requireOrgMember |
| Calculation Runs | `/api/orgs/[orgId]/calculation-runs/...` | requireOrgMember |
| Reporting Periods | `/api/orgs/[orgId]/reporting-periods/...` | requireOrgMember |
| Snapshots | `/api/orgs/[orgId]/snapshots/...` | requireOrgMember |
| Reports | `/api/orgs/[orgId]/reports/...` | requireOrgMember |
| Contracts/Projects/Sites | `/api/orgs/[orgId]/contracts/...` | requireOrgMember |
| Social Value | `/api/orgs/[orgId]/social-value/...` | requireOrgMember |
| Evidence | `/api/orgs/[orgId]/evidence/...` | requireOrgMember |
| Dashboard | `/api/orgs/[orgId]/dashboard` | requireOrgMember (anyMember) |
| Audit Log | `/api/orgs/[orgId]/audit` | requireOrgMember |
| Platform Admin | `/api/platform/orgs/...` | requirePlatformMember |

### Storage

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/uploads/presign` | Bearer/cookie session + org membership |
| `GET`  | `/api/storage/serve` | HMAC signature (DB driver) |
| `POST` | `/api/storage/upload` | HMAC signature (DB driver) |
| `GET`  | `/api/dev/storage/serve` | Dev-only (NODE_ENV check, no session) |
| `POST` | `/api/dev/storage/upload` | Dev-only (NODE_ENV check, no session) |

---

## 2. Missing / Incomplete Endpoints

| Gap | Severity | Detail |
|-----|----------|--------|
| No `PATCH` on `/api/orgs/[orgId]/field-submissions/[submissionId]` | Low | Field workers have no self-service way to correct a submission (only `resubmit`). A `needs_info` → correction flow may be missing from mobile contract. |
| No `DELETE` on `/api/orgs/[orgId]/field-submissions/[submissionId]` | Low | Retracted/erroneous submissions cannot be purged; soft-delete option absent. |
| No endpoint to list all open invite links per email | Low | Admin has no way to query "all pending invites for alice@example.com" without scanning all invite-links manually. |
| No CSRF protection middleware | Medium | `app/middleware.ts` does not exist. Better Auth cookie sessions are vulnerable to CSRF on state-changing requests from browser clients. |
| No `GET /api/orgs/[orgId]/field-submissions/[submissionId]/files` | Low | Files are embedded in the submission GET response but no standalone listing endpoint exists. |
| Platform API has no write endpoints | Info | `/api/platform/orgs/[orgId]` has PATCH/DELETE but no create-org from platform. Intentional? |
| No push token management endpoint beyond `/api/push-tokens` | Info | Mobile FCM token registration exists but no revoke/list endpoint for admins. |

---

## 3. Authentication & Invite Flow

### Full invite flow (field worker)

```
Admin: POST /api/orgs/{orgId}/invite-links
  → creates InviteLink(token=UUID, role=field_worker, siteId?, expiresAt=now+7d)
  → returns inviteUrl = APP_URL/invite/{token}

Admin shares deep-link out-of-band (SMS / QR code)

Field worker opens deep-link → Flutter → POST /api/auth/accept-invite
  body: { token, name, [email] }
  → validates expiry, single-use, email match
  → creates/finds User (no password; JWT-only)
  → creates OrganizationMembership(role=field_worker)
  → if siteId: creates FieldWorkerSiteAssignment
  → marks invite usedAt
  → creates Session(token=UUID, expiresAt=+30d) in DB
  → returns { sessionToken, user, org, role }

Flutter stores sessionToken in flutter_secure_storage

All subsequent requests: Authorization: Bearer {sessionToken}
Mobile token refresh on 401: POST /api/auth/token
  → rotates sessionToken, extends +30d (grace window: 60d post-expiry)
```

### Full invite flow (privileged org member, email-bound)

```
Admin: POST /api/orgs/{orgId}/members  { email, role }
  → if user exists: adds membership directly + sends notification email
  → if user absent: creates InviteLink(token, email, role, expiresAt=+7d)
               + sends email with inviteUrl
  
Invitee clicks link → web browser → POST /api/auth/accept-invite
  body: { token, name, email }
  → validates email matches invite.email
  → creates User if new, creates membership, marks invite used
  → returns sessionToken (web then calls Better Auth sign-in instead)
```

---

## 4. Security Findings

### FINDING-001 — In-memory rate limiter is instance-scoped (Medium)
**File:** `lib/security/rate-limit.ts`  
**Detail:** The rate limiter uses a module-level `Map`. In any horizontally scaled deployment (Vercel serverless, multiple Fly machines, or multiple worker processes), each instance has a separate store. An attacker can bypass rate limits by routing successive requests to different instances.  
**Affected endpoints:** `/api/auth/accept-invite` (5 req / 15 min limit), `/api/auth/[...all]` (sign-in brute-force), invite creation.  
**Remediation:** Replace in-memory store with Upstash Redis or a Postgres-backed counter before scaling beyond a single process. The module's public API is already designed for this swap.

### FINDING-002 — `/api/auth/token` (mobile refresh) has no rate limit (Medium)
**File:** `app/api/auth/token/route.ts`  
**Detail:** The token refresh endpoint does not call `rateLimitRequest`. The policy `POLICIES.tokenRefresh` (60 req / 15 min) is defined but never wired to this route. An attacker who captures a Bearer token can call this endpoint indefinitely to keep rolling the session, and a broken client can DOS the Postgres session table.  
**Remediation:** Add `rateLimitRequest(req, POLICIES.tokenRefresh)` at the top of the handler.

### FINDING-003 — 60-day session grace window after expiry (Low-Medium)
**File:** `app/api/auth/token/route.ts`, line 16  
**Detail:** `GRACE_MS = 60 * 24 * 60 * 60 * 1000`. A field worker's session that expires (30 days) can be refreshed for another 60 days after expiry, giving a 90-day total window after the original invite. If a token is compromised, revocation requires a manual DB delete.  
**Remediation:** Reduce grace window to 7 days; add an admin endpoint to revoke all sessions for a user.

### FINDING-004 — Dev storage endpoints have no authentication (Low, dev-only)
**File:** `app/api/dev/storage/serve/route.ts`, `app/api/dev/storage/upload/route.ts`  
**Detail:** Both endpoints are guarded only by `NODE_ENV !== "production"` and `STORAGE_DRIVER === "local"`. Any user who can reach the dev server can read or overwrite any storage key (including other tenants' files) without credentials.  
**Remediation:** Add `requireSession()` to both dev routes. Low priority given dev-only guard.

### FINDING-005 — DB-driver storage URLs use a fallback secret (Low)
**File:** `lib/storage/signing.ts`, line 9  
**Detail:** When `BETTER_AUTH_SECRET` is unset, `signStorageUrl()` falls back to the hardcoded string `"carbonsite-dev-storage-secret"`. If this string is known (it's public in the repo), anyone can forge valid presigned download/upload URLs for any storage key.  
**Remediation:** Remove the fallback; throw at startup if `BETTER_AUTH_SECRET` is absent. Already guarded in `lib/auth/index.ts` for non-build phases — apply the same to the signing module.

### FINDING-006 — `ROLE_GROUPS.anyMember` excludes `field_worker` (Low, intentional)
**File:** `lib/auth/session.ts`, lines 88–93  
**Detail:** `field_worker` is deliberately absent from `anyMember`. The dashboard endpoint uses `requireOrgMember(orgId, ...ROLE_GROUPS.anyMember)`, so field workers correctly cannot access dashboards. Confirm this is intentional and document it — a future developer adding `field_worker` to `anyMember` to "fix a 403" would be a privilege escalation.  
**Remediation:** Add an inline comment in `ROLE_GROUPS.anyMember` stating field_worker exclusion is intentional.

### FINDING-007 — Invite URL token travels in HTTP referer / server logs (Info)
**File:** `app/api/orgs/[orgId]/members/route.ts`, `app/api/orgs/[orgId]/invite-links/route.ts`  
**Detail:** Invite tokens are UUID v4 (122 bits, cryptographically secure) but appear in URL paths (`/invite/{token}`). If the user's browser sends a `Referer` header on the next navigation, the token leaks. In practice single-use tokens mitigate this.  
**Remediation:** Consider sending the token as a URL fragment (`#token=…`) so it never reaches the server, or enforce single-use at the Accept step and limit the invite-link GET to admin only.

### FINDING-008 — Missing CSRF protection on cookie-based sessions (Medium)
**File:** No middleware present  
**Detail:** Better Auth sessions use `Set-Cookie`. Next.js App Router API routes do not add `SameSite=Strict` headers by default. A malicious third-party page can trigger state-changing requests (POST to `/api/orgs/[orgId]/members`, DELETE to `/api/orgs/[orgId]/invite-links/[id]`) using a `<form>` pointing at the API, if a user is logged in.  
**Remediation:** Configure Better Auth `session.cookieOptions` with `sameSite: "lax"` (or `"strict"`). Verify this is set in `lib/auth/index.ts`. Add a `middleware.ts` that validates `Origin` / `Referer` on state-mutating requests from browser clients.

### FINDING-009 — `X-Forwarded-For` spoofable if not behind a trusted proxy (Low)
**File:** `lib/security/rate-limit.ts`, line 60  
**Detail:** `rateLimitRequest` reads the first value of `X-Forwarded-For`. If the application is not behind a known-good reverse proxy that strips/replaces this header, an attacker can set `X-Forwarded-For: 1.2.3.4` to rotate through arbitrary IPs and bypass rate limits.  
**Remediation:** Configure a trusted-proxy IP list (or use the `REMOTE_ADDR` equivalent from the platform) and only trust the last IP in `X-Forwarded-For` appended by the trusted proxy.

---

## 5. Tenant Isolation Analysis

All database queries in org-scoped routes include `organizationId: orgId` in the `where` clause. Cross-tenant access is protected by:

1. `requireOrgMember(orgId, ...roles)` — verifies the authenticated user has a membership in the requested org before any DB operation.
2. Secondary ownership checks on nested resources (evidence files, facilities, sites, reporting periods) confirm `organizationId` before returning or mutating data.
3. Storage keys follow `org/{orgId}/...` convention; `isValidStorageKey()` validates the prefix; `presignUpload` verifies org membership before issuing a URL.

**Confirmed isolated per tenant:**
- `FieldSubmission` — `organizationId` in all queries
- `ActivityRecord` — `organizationId` in all queries
- `EvidenceFile` — ownership check in field submission POST
- `InviteLink` — ownership check in DELETE handler
- `FieldWorkerSiteAssignment` — `organizationId` in all queries
- File storage keys — `org/{orgId}/` prefix enforced

**No cross-tenant vectors found** in the current implementation for authenticated requests.

---

## 6. OpenAPI Draft (field-worker surface)

```yaml
openapi: "3.1.0"
info:
  title: CarbonSite Field Worker API
  version: "1.0.0"
servers:
  - url: "{APP_URL}"
    variables:
      APP_URL:
        default: http://localhost:3000

paths:
  /api/auth/accept-invite:
    post:
      summary: Accept an invite link and create a session
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [token, name]
              properties:
                token: { type: string }
                name: { type: string, maxLength: 100 }
                email: { type: string, format: email }
      responses:
        "200":
          description: Session created
          content:
            application/json:
              schema:
                type: object
                properties:
                  sessionToken: { type: string }
                  user:
                    type: object
                    properties:
                      id: { type: string }
                      name: { type: string }
                      email: { type: string }
                  org:
                    type: object
                    properties:
                      id: { type: string }
                      name: { type: string }
                  role: { type: string }
        "400": { description: Invite expired or already used }
        "404": { description: Invite not found }
        "429": { description: Rate limited }

  /api/auth/token:
    post:
      summary: Refresh mobile Bearer token
      security:
        - BearerAuth: []
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  token: { type: string }
                  expiresAt: { type: string, format: date-time }
        "401": { description: Invalid or expired token }

  /api/orgs/{orgId}/my-sites:
    get:
      summary: List sites assigned to the calling field worker
      security:
        - BearerAuth: []
      parameters:
        - name: orgId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    assignmentId: { type: string }
                    id: { type: string }
                    name: { type: string }
                    siteCode: { type: string }
                    postcode: { type: string }
                    city: { type: string }
                    projectId: { type: string }
                    projectName: { type: string }
                    projectStatus: { type: string }

  /api/orgs/{orgId}/field-submissions:
    post:
      summary: Submit a field evidence record (OCR result, waste ticket, etc.)
      security:
        - BearerAuth: []
      parameters:
        - name: orgId
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [documentType, formData]
              properties:
                siteId: { type: string }
                reportingPeriodId: { type: string }
                documentType:
                  type: string
                  enum: [waste_ticket, delivery_note, fuel_receipt, other]
                formData: { type: object }
                emissionCategoryId: { type: string }
                facilityId: { type: string }
                ocrExtractedData: { type: object }
                gpsLat: { type: number, minimum: -90, maximum: 90 }
                gpsLng: { type: number, minimum: -180, maximum: 180 }
                deviceSubmittedAt: { type: string, format: date-time }
                idempotencyKey: { type: string, maxLength: 128 }
                evidenceIds:
                  type: array
                  items: { type: string }
      responses:
        "201": { description: Submission created }
        "200": { description: Idempotent replay — existing submission returned }
        "400": { description: Validation error }
        "403": { description: Not assigned to this site }
        "422": { description: No reporting period configured }

  /api/orgs/{orgId}/field-submissions/{submissionId}:
    get:
      summary: Get a single submission (field workers see only their own)
      security:
        - BearerAuth: []
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string }
                  documentType: { type: string }
                  status: { type: string }
                  createdAt: { type: string, format: date-time }
                  reviewNote: { type: string }
                  co2eKg: { type: number }
                  scope: { type: string }
                  siteId: { type: string }
                  evidenceFiles:
                    type: array
                    items:
                      type: object
                      properties:
                        id: { type: string }
                        filename: { type: string }
                        downloadUrl: { type: string }
        "404": { description: Not found }

  /api/uploads/presign:
    post:
      summary: Request a presigned upload URL for evidence files
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [filename, contentType, byteSize, checksum]
              properties:
                filename: { type: string }
                contentType: { type: string }
                byteSize: { type: integer }
                checksum: { type: string }
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  url: { type: string }
                  key: { type: string }
                  expiresAt: { type: string, format: date-time }

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
```
