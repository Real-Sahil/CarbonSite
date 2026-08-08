# Phase 3 Progress

## Workstreams

| # | Name | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Field Worker App | P0 | In Progress | OCR validation panel added; barcode scanner & offline sync already shipped |
| 2 | Audit Trail | P0 | Done | List API, CSV/JSON export, admin UI, auditor RBAC gate |
| 3 | RBAC | P1 | Partial | 6-role model live; project-level permissions in schema |
| 4 | Notifications | P1 | Not Started | Resend (email) + FCM (push) scaffolding exists |
| 5 | API Access | P1 | Done | ApiKey model, create/list/delete endpoints, settings UI |
| 6 | Performance | P2 | Not Started | Indexes on ActivityRecord exist; Readyset requires Docker (out of scope) |
| 7 | i18n | P2 | Not Started | next-intl to be wired |
| 8 | Help Centre | P2 | Not Started | In-app FAQ planned; Frappe requires Python (out of scope) |
| 9 | Certifications | P2 | Not Started | AuditKit patterns applied to existing audit.ts |

---

## Workstream 1: Field Worker App

**Shipped (prior phases):**
- Offline-first SQLite draft queue via drift
- Background sync with exponential backoff (sync_service.dart)
- On-device ML Kit OCR with per-field confidence scores (ocr_extractor.dart)
- Barcode/QR scanning via mobile_scanner (barcode_scan_screen.dart)
- Site-scoped submission flow with GPS tagging

**Phase 3 additions:**
- `ocr_validation_panel.dart` — expandable confidence summary shown before submit
  - Green: >= 85% confidence (auto-filled, high trust)
  - Amber: 50–84% (review suggested)
  - Red: < 50% (manual entry recommended)
  - Collapses when all fields are high confidence; auto-expands when review needed

**Pending:**
- Real-time OCR validation on in-flight typing (debounced re-extraction)
- Photo hash verification to detect document substitution
- Offline map tile caching for GPS-tagged areas

---

## Workstream 2: Audit Trail

**API routes:**
- `GET /api/orgs/[orgId]/audit-logs` — paginated list, cursor-based, filter by action/resource/actor/date range; requires admin or auditor role
- `GET /api/orgs/[orgId]/audit-logs/export?format=csv|json` — streams up to 10,000 rows; logs `audit.export_downloaded` to self

**Settings UI:**
- `settings/audit/page.tsx` — sortable table with action colour-coding, actor display, metadata preview, load-more pagination, CSV + JSON export triggers

**New audit actions added to `lib/db/audit.ts`:**
- `api_key.created`
- `api_key.deleted`
- `notification.sent`
- `record.version_snapshot`

**Notes:**
- AuditLog is Postgres append-only (no UPDATE/DELETE) enforced at application level
- Export endpoint writes its own audit entry (`audit.export_downloaded`) to maintain chain of custody
- SOC 2 alignment: all auth, record mutations, imports, calculations, snapshots, and field submissions covered

---

## Workstream 5: API Access

**Schema:**
- `ApiKey` model in `prisma/schema.prisma`
- Migration: `prisma/migrations/20260808_add_api_keys/migration.sql`
- Raw key shown once on creation; only SHA-256 hash persisted (`key_hash` column)
- Prefix stored for display without exposing the secret
- Max 10 keys per org enforced at API layer

**API routes:**
- `GET /api/orgs/[orgId]/api-keys` — list keys (prefix shown, no hash)
- `POST /api/orgs/[orgId]/api-keys` — create, returns `rawKey` once
- `DELETE /api/orgs/[orgId]/api-keys/[keyId]` — revoke

**Settings UI:**
- `settings/api-keys/page.tsx` — create/list/revoke table, one-time key display with clipboard copy

**Pending:**
- Webhook delivery retries (exponential backoff on 5xx)
- API key authentication middleware for `/api/v1/` public routes
- Bulk export endpoints (CSV/Excel of activity records, calculations)
- Rate limiting on API key authenticated requests

---

## Pre-Publication Security Checklist

- [ ] Remove AI attribution from code/docs/commits before making repo public
- [ ] Run Gitleaks on full git history: `gitleaks detect --source . --log-opts="--all"`
- [ ] Audit `.env.example` — ensure no real values
- [ ] Enable GitHub Secret Scanning + Push Protection on repo settings
- [ ] Enable Dependabot alerts
- [ ] Add `docs/attributions.md` for all borrowed patterns
- [ ] Clean commit history of any accidentally committed secrets (git-filter-repo)

---

## Architecture Notes

**Stack constraints (no Docker, no paid tiers):**
- Readyset (PostgreSQL caching) requires Docker — not applicable. Use Prisma query optimisation + indexes instead.
- Frappe Helpdesk requires Python/Docker — not applicable. Build in-app FAQ as static content.
- Novu has a free tier (30k events/month) but introduces an external runtime dependency. Resend + FCM already cover email + push for MVP.

**Tenant isolation:** every new endpoint calls `requireOrgMember(orgId, ...)` before any DB access. ApiKey, AuditLog, and all downstream tables include `organizationId` and are queried with explicit org scope.
