# Security Audit — CarbonSite

---

## Summary Score: 62 / 100

Core authorization patterns are solid (server-side `requireOrgMember`, Zod validation, append-only audit log). Critical gaps: race conditions in auth flows, no rate limiting, incomplete `field_worker` isolation, and an EOL parsing dependency.

---

## Risk Matrix

| ID | Issue | Severity | Likelihood | Risk |
|---|---|---|---|---|
| S01 | Race condition in accept-invite (user + account creation outside tx) | Critical | Medium | **High** |
| S02 | No rate limiting on any endpoint | High | High | **High** |
| S03 | `field_worker` can list all facilities and reporting periods | High | Medium | **High** |
| S04 | `xlsx` 0.18.5 is EOL — no security patches | High | Low | **Medium** |
| S05 | Flutter API base URL is runtime-configurable from storage | High | Low | **Medium** |
| S06 | No HMAC signature on invite tokens | Medium | Low | **Low** |
| S07 | STORAGE_DRIVER=r2 credentials in env not validated at startup | Medium | Low | **Low** |
| S08 | `presignUpload` key validation is regex-only (no path traversal guard) | Medium | Low | **Low** |
| S09 | Session token is a plain UUID — no expiry on JWT for Flutter | Medium | Medium | **Medium** |
| S10 | No CSP, no security headers | Medium | Medium | **Medium** |
| S11 | `firebase-admin` service account JSON stored as env var string | Low | Low | **Low** |
| S12 | Audit log action type for org creation uses `record.created` (wrong) | Low | Low | **Low** |

---

## Detailed Findings

### S01 — Race Condition in Accept-Invite (Critical)

**File:** `app/api/auth/accept-invite/route.ts:40`

```typescript
let user = await prisma.user.findUnique({ where: { email } });

if (!user) {
  user = await prisma.user.create({ data: { id: userId, email, name: body.name } });

  await prisma.account.create({ ... });  // ← separate operation, outside transaction
}
```

**Problem:** Two concurrent requests with the same token can both read `user = null`, both attempt `prisma.user.create()`. The second will crash with a unique constraint violation on `email`. More critically, if `user.create` succeeds but `account.create` fails, you have an orphaned user with no auth account — they can never log in.

**Business impact:** Field workers attempting to accept an invite on slow networks may double-tap "Join" — the second request leaves the system in a broken state.

**Remediation:**

```typescript
// Move all creation into the transaction
const [user, sessionToken] = await prisma.$transaction(async (tx) => {
  let existingUser = await tx.user.findUnique({ where: { email } });

  if (!existingUser) {
    existingUser = await tx.user.create({ data: { id: randomUUID(), email, name: body.name } });
    await tx.account.create({
      data: {
        id: randomUUID(),
        userId: existingUser.id,
        accountId: email,
        providerId: "credential",
        password: null,
      },
    });
  }

  // Check membership within same tx to avoid TOCTOU
  const existingMembership = await tx.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId: existingUser.id } },
  });

  if (existingMembership) {
    throw new ConflictError("ALREADY_MEMBER");
  }

  const token = randomUUID();
  await tx.organizationMembership.create({ ... });
  await tx.inviteLink.update({ ... });
  await tx.session.create({ ... });

  return [existingUser, token];
});
```

---

### S02 — No Rate Limiting (High)

**Files:** All API routes, particularly `app/api/auth/[...all]/route.ts`, `app/api/auth/accept-invite/route.ts`

No rate limiting exists on:
- Sign-in attempts (brute-force credentials)
- Invite token validation (enumeration of valid tokens)
- Presigned URL generation (storage abuse)
- Reporting period / facility creation (resource exhaustion)

**Business impact:** A bot can enumerate invite tokens by UUID (10^38 token space, so practically safe from brute force, but the endpoint returns different error messages for `INVITE_NOT_FOUND` vs `INVITE_EXPIRED` vs `INVITE_ALREADY_USED` — this leaks state).

**Remediation:**

Add Next.js middleware with `@upstash/ratelimit` (free Upstash tier) or a simple Postgres-backed counter:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_ROUTES = ['/api/auth/sign-in', '/api/auth/accept-invite'];

export function middleware(req: NextRequest) {
  // Upstash Redis rate limit or Postgres counter
}
```

Alternatively use Vercel's built-in Edge rate limiting if deploying on Vercel.

---

### S03 — `field_worker` Can Access Org Structure Data (High)

**Files:**  
- `app/api/orgs/[orgId]/facilities/route.ts:14`
- `app/api/orgs/[orgId]/business-units/route.ts:14`
- `app/api/orgs/[orgId]/reporting-periods/route.ts:14`

All three GET handlers include `"field_worker"` in `requireOrgMember` allowed roles:

```typescript
await requireOrgMember(
  orgId,
  "admin", "editor", "reviewer", "viewer", "auditor", "field_worker",
);
```

**Architecture spec says:** `field_worker` can only "View status of their own submissions — zero access to org dashboards, calculations, or other users' records."

Listing all facilities reveals org sites. Listing all reporting periods reveals the org's reporting calendar. This violates the stated isolation requirement.

**Note:** The Flutter `endpoints.dart` does call `getProjects()` which hits the reporting-periods endpoint — so this is intentional for the mobile app. However, the facility and business-unit endpoints have no such justification.

**Remediation:**

For facilities/business-units: remove `field_worker` from allowed roles.

For reporting-periods: the mobile app needs this. Instead, only return periods the field worker has been assigned submissions for, or maintain the current behavior with a documented justification in CLAUDE.md.

---

### S04 — `xlsx` 0.18.5 EOL (High)

**File:** `package.json`

```json
"xlsx": "^0.18.5"
```

SheetJS (xlsx) 0.18.5 was the last MIT-licensed version before SheetJS moved to a dual-license model. The open-source 0.18.x branch receives no security patches. Known historical issues include formula injection via crafted CSV/Excel files, which is directly relevant to the import pipeline.

**Business impact:** A malicious CSV file submitted via the import endpoint could potentially exploit unpatched vulnerabilities in the parsing library.

**Remediation:**

Replace with `papaparse` (CSV-only, MIT, actively maintained) for CSV imports, and `exceljs` (MIT, maintained) for Excel:

```bash
pnpm remove xlsx
pnpm add papaparse exceljs
pnpm add -D @types/papaparse
```

Or purchase a SheetJS Pro license if Excel compatibility is required.

---

### S05 — Flutter API Base URL Configurable at Runtime (High)

**File:** `mobile/lib/core/api/client.dart:35`

```dart
final baseUrl =
    await _storage.read(key: 'api_base_url') ?? 'http://localhost:3000';
```

Any process or SDK that can write to the device's secure storage can redirect all API calls to an attacker-controlled server. This is a MITM vector if an installed app (or a malicious MDM profile) writes to this key.

**Remediation:**

```dart
// Use compile-time constants via --dart-define
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://app.carbonsite.co',
);

Dio createApiClient() {
  return Dio(BaseOptions(baseUrl: apiBaseUrl, ...));
}
```

Build flavors: `flutter run --dart-define=API_BASE_URL=https://app.carbonsite.co`

---

### S06 — Invite Tokens Are Plain UUIDs (Medium)

**Files:** `app/api/orgs/[orgId]/invite-links/route.ts:43`, `app/api/auth/accept-invite/route.ts`

```typescript
const token = randomUUID();
```

UUID v4 tokens are cryptographically random (128-bit). The immediate risk is low. However:
- The token cannot be validated structurally — any UUID passes the format check
- Tokens cannot be signed to embed expiry or org-scoping, requiring a DB lookup on every validation
- No mechanism to invalidate all tokens for an org on a security incident without deleting them from DB

**Remediation (optional, medium priority):**

Use a HMAC-signed token to embed verifiable claims:
```typescript
import { createHmac } from 'crypto';
const payload = Buffer.from(JSON.stringify({ orgId, role, exp: expiresAt.getTime() })).toString('base64url');
const sig = createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(payload).digest('base64url');
const token = `${payload}.${sig}`;
```

This allows structural validation before any DB query.

---

### S08 — Storage Key Validation Is Regex-Only (Medium)

**File:** `app/api/uploads/presign/route.ts:19`

```typescript
const keyMatch = key.match(/^org\/([^/]+)\//);
if (!keyMatch) {
  return apiError("INVALID_KEY", "...", 400);
}
```

This validates the key structure but does not prevent:
- Path traversal via `../` inside the path (e.g., `org/legit-org/../../other-file`)
- Very long keys (no max length)
- Keys with null bytes

**Remediation:**

```typescript
const key = body.key;
if (key.includes('..') || key.includes('\0') || key.length > 1024) {
  return apiError("INVALID_KEY", "Invalid storage key.", 400);
}
// Also verify the orgId from the key matches the session org membership (already done)
```

---

### S09 — Flutter Sessions Have No Server-Side Expiry Enforcement (Medium)

**File:** `app/api/auth/accept-invite/route.ts:60`

```typescript
const sessionExpiresAt = new Date(now.getTime() + 30 * 86_400_000); // 30 days
```

The session record in Postgres has an `expiresAt` field. However, the Flutter client sends a Bearer token, and the backend `requireOrgMember()` calls `auth.api.getSession({ headers })` — which is Better Auth's cookie session handler. For JWT/Bearer validation, Better Auth's behavior needs to be verified to ensure expired tokens are rejected server-side.

**Recommended verification:** Test that a request with a 31-day-old session token returns 401.

---

### S10 — No HTTP Security Headers (Medium)

No `next.config.js` or `headers()` function exists to set:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

**Remediation:** Add a `next.config.ts` with `headers()`:

```typescript
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
```

---

## OWASP Top 10 Assessment

| OWASP Category | Status | Notes |
|---|---|---|
| A01 Broken Access Control | Partial | `requireOrgMember` is solid; `field_worker` scope violation (S03) |
| A02 Cryptographic Failures | Low risk | Sessions use Better Auth; invite tokens are UUID (acceptable) |
| A03 Injection | Low risk | All input through Zod + Prisma parameterized queries; `xlsx` EOL risk |
| A04 Insecure Design | Medium | Race condition in accept-invite (S01) |
| A05 Security Misconfiguration | Medium | No security headers (S10); no rate limiting (S02) |
| A06 Vulnerable Components | High | `xlsx` EOL (S04) |
| A07 Auth Failures | Medium | No rate limiting on auth; Flutter session refresh (S09) |
| A08 Software Integrity | Low | `pnpm-lock.yaml` present; CI uses `--frozen-lockfile` |
| A09 Logging Failures | Low | Audit log present; no error alerting |
| A10 SSRF | Low | `presignUpload` generates URLs server-side; `STORAGE_ENDPOINT` is env-controlled |

---

## Secrets Exposure Check

- `.env.example` checked in with placeholder values — correct, no real secrets
- No `.env` or `.env.local` committed (gitignore should cover this, but no `.gitignore` found in the repository)
- `FIREBASE_SERVICE_ACCOUNT_JSON` is a JSON blob stored as an env var — acceptable, never committed
- No hardcoded secrets found in TypeScript or Dart source
- `uploads/` local dev directory: no `.gitignore` found — if accidentally committed, evidence files would be in git history

**Action:** Add a `.gitignore` file:
```
.env
.env.local
.env*.local
uploads/
*.jks
*.keystore
```
