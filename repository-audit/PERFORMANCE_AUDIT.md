# Performance Audit — CarbonSite

---

## Summary Score: 58 / 100

The calculation engine is architecturally designed for scale (DashboardAggregate, immutable EmissionCalculation rows, async workers). However, no database indexes are defined, every API request makes 2 serial database calls for auth, several list endpoints lack pagination, and the Flutter app has no caching layer.

---

## 1. Database Query Performance

### Missing Indexes (Critical)

**File:** `prisma/schema.prisma`

No `@@index` directives exist in the entire schema. Prisma creates indexes only for `@unique`, `@id`, and explicit `@@unique` constraints. All other queries table-scan.

**Impact at scale (50k activity records):**

| Query | Current | With index |
|---|---|---|
| `InviteLink.findUnique({ where: { token } })` | Full scan | Index seek: <1ms |
| `AuditLog paginate by org + date` | Full scan: >500ms | Index range: <5ms |
| `ActivityRecord filter by org + period + status` | Full scan: >1s | Composite index: <20ms |
| `FieldSubmission list by org + status` | Full scan: >100ms | Index seek: <3ms |
| `OrganizationMembership.findMany by org` | Full scan | Covered by @@unique |

**Recommended additions to `schema.prisma`:**

```prisma
model InviteLink {
  @@index([token])
  @@index([organizationId, expiresAt, usedAt])
}

model AuditLog {
  @@index([organizationId, createdAt(sort: Desc)])
  @@index([actorUserId])
}

model ActivityRecord {
  @@index([organizationId, reportingPeriodId, reviewStatus, createdAt(sort: Desc)])
  @@index([organizationId, categoryId])
  @@index([importBatchId])
}

model FieldSubmission {
  @@index([organizationId, status, createdAt(sort: Desc)])
  @@index([submittedByUserId])
}

model EmissionCalculation {
  @@index([activityRecordId])
  @@index([calculationRunId])
}

model Session {
  @@index([userId, expiresAt])
}

model DashboardAggregate {
  @@index([snapshotId, scope, categoryId])
}
```

---

### Serial Auth Queries on Every Request (High)

**File:** `lib/auth/session.ts:9`

Every org-scoped API request makes two sequential database queries:

```typescript
// Query 1: get session (via Better Auth)
const session = await auth.api.getSession({ headers: await headers() });

// Query 2: look up membership
const membership = await prisma.organizationMembership.findUnique({
  where: { organizationId_userId: { organizationId: orgId, userId: session.user.id } },
});
```

Both queries are individually fast (indexed), but they are sequential and happen on every single request — even for endpoints like GET that could use a short-lived cache.

**Recommendation:** For read-heavy routes, consider an in-process LRU cache (e.g., `lru-cache`) keyed on `(sessionToken, orgId)` with a 60-second TTL. This would reduce DB load by ~50% on active sessions.

---

### In-Memory Factor Scoring (Medium)

**File:** `lib/calculation/factor-selector.ts:17`

```typescript
const candidates = await prisma.emissionFactor.findMany({
  where: { factorLibraryId: query.factorLibraryId, emissionCategoryId: query.emissionCategoryId, ... },
});
// ... scored in JavaScript
scored.sort((a, b) => b.score - a.score);
```

All emission factors for a category are loaded into Node.js memory and scored in JS. For the seeded DEFRA/EPA libraries with ~100 factors per category, this is fine. At 10,000+ factors (if additional libraries are imported), this becomes a significant memory spike in the calculation worker.

**Recommendation:** Push scoring into SQL using a `CASE WHEN` expression and `ORDER BY score DESC LIMIT 1` to return only the best match from the database.

---

### `SubmissionsPage` Lacks Pagination (High)

**File:** `app/(app)/orgs/[orgId]/submissions/page.tsx:78`

```typescript
const submissions = await prisma.fieldSubmission.findMany({
  where: { organizationId: orgId },
  ...
  take: 50,         // hardcoded limit
});
```

This is a server component with a fixed `take: 50`. As submissions grow, the page always loads the 50 most recent — fine initially. However:
- No cursor is exposed
- No URL-based pagination
- The count in the heading shows the loaded count (≤50), not total count

**Recommendation:** Add cursor-based pagination with `cursor` and `take` query params, as specified in CLAUDE.md.

---

## 2. API Performance

### Double DB Call in Org Layout (Medium)

**File:** `app/(app)/orgs/[orgId]/layout.tsx:18`

```typescript
const result = await requireOrgMember(orgId);   // DB calls: session + membership
// ...
const org = await prisma.organization.findUnique({ where: { id: orgId } });  // 3rd call
```

Three sequential DB calls on every page load in the org layout. The session and org lookup can be parallelized.

**Recommendation:**
```typescript
const [{ session, membership }, org] = await Promise.all([
  requireOrgMember(orgId),
  prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } }),
]);
```

---

### `MembersPage` Runs Two Parallel Queries (Good)

**File:** `app/(app)/orgs/[orgId]/settings/members/page.tsx:70`

```typescript
const [members, inviteLinks] = await Promise.all([...]);
```

This is the correct pattern. Carried throughout.

---

## 3. Flutter Performance

### No Caching for Project List (Medium)

**File:** `mobile/lib/features/submissions/home_screen.dart`

Projects are fetched on every screen load via `initState()`. There is no caching. A field worker opening the app on a site with intermittent connectivity will see a loading spinner every time they navigate to home.

**Recommendation:** Use Riverpod's `AsyncNotifier` with a `keepAlive()` or time-based cache:
```dart
@Riverpod(keepAlive: true)
Future<List<Project>> projects(ProjectsRef ref) async { ... }
```

---

### Large ML Kit Initialization (Low — acceptable for MVP)

`google_mlkit_text_recognition` initializes a TensorFlow Lite model on first use. On mid-range Android devices this takes 1–3 seconds. This should happen in the background when the capture screen is first approached, not at the moment the user presses "Recognize".

---

## 4. Bundle Size

### Web Bundle

`motion` (^12.40.0) is listed in `dependencies` but never imported anywhere in the codebase. This animation library adds significant bundle weight (~50–80 KB gzipped) for zero benefit.

`@hookform/resolvers` is similarly installed but unused.

**Action:** Remove both from `package.json`.

### Flutter APK Size

All declared dependencies will be included in the APK even if unused at runtime. `connectivity_plus`, `geolocator`, `mobile_scanner`, `fl_chart`, `share_plus`, `image_cropper` add permissions and native code to the binary without providing any functionality.

**Note:** This is a valid pre-implementation state (deps declared for Milestone 2), but build size will be inflated for current Milestone 1 releases.

---

## 5. Startup Performance

### Web (Cold Start)

No `next.config.ts` exists, so Next.js uses defaults. No `experimental.optimizeCss`, no route segment config (`export const dynamic = 'force-static'`) on static pages.

### Flutter (Cold Start)

`main.dart` calls `WidgetsFlutterBinding.ensureInitialized()` (correct). No expensive initialization happens at startup. GoRouter's async redirect adds one `flutter_secure_storage` read to the startup path — acceptable (<1ms typically).

---

## 6. Caching Strategy

### Current State
- No in-memory caching
- No CDN configuration
- No HTTP cache headers on API responses
- No stale-while-revalidate

### Recommendations

| Layer | Recommendation | Impact |
|---|---|---|
| Auth session | LRU cache for (token, orgId) → membership | -50% auth DB queries |
| Emission factors | Cache in calculation worker memory (factors don't change at runtime) | -90% factor queries during a calculation run |
| Dashboard aggregates | Pre-computed via DashboardAggregate (already planned) — never query raw EmissionCalculation at request time | Constant-time dashboard loads |
| API responses | Add `Cache-Control: private, max-age=0, must-revalidate` on org data | Prevents browser caching of tenant data |
| Flutter | Add keep-alive providers for projects + submissions | Eliminates loading spinner on navigation |

---

## 7. Performance Constraints from CLAUDE.md

| Constraint | Current Status |
|---|---|
| Dashboard load < 3s for 100k records | Not achievable without DashboardAggregate implementation + indexes |
| CSV imports up to 25k rows async | Worker is a stub — not implemented |
| Stream large exports, no full load into memory | Not implemented |
| Required indexes on ActivityRecord | None defined |
