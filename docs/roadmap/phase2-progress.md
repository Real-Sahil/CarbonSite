# Phase 2 Progress

**Last updated:** 2026-08-24

---

## Workstream 1: Embodied Carbon (P0)

**Status: Complete**

### What was built

- **`EmbodiedMaterial` model** — global ICE v3.0 material library (36 materials seeded across concrete, steel, timber, masonry, insulation, glass, aluminium, finishes, services).
- **`EpdRecord` model** — org-scoped EPD overrides; linked to global material or standalone.
- **`EmbodiedCarbonRecord` model** — per-project records with stored GWP values for full audit trail.
- **`lib/embodied-carbon/engine.ts`** — pure `calculateEmbodiedCarbon()` function: unit conversion (kg/tonne/m3/m2), lifecycle stage selection (A1-A3, A4, A5, C1-C4, D), density-based m3 conversion, warnings on missing factors.
- **API: `GET/POST /api/orgs/[orgId]/embodied-carbon`** — tenant-scoped, requires `admin|editor` to write.
- **API: `GET /api/materials`** — global material library, auth-gated (any session).
- **UI: `/orgs/[orgId]/embodied-carbon`** — breakdown chart by category, add-record form with lifecycle stage selector, records table with tCO2e formatting.
- **Sidebar:** "Embodied Carbon" nav item added under Calculations group.

### Test coverage

`tests/embodied-carbon/engine.test.ts` — 14 tests verifying:
- Concrete 1000 kg A1-A3 = 110 kgCO2e (ICE v3.0)
- Steel 500 kg A1-A3 = 885 kgCO2e
- Tonne-to-kg unit conversion (timber)
- m3 via density (concrete 2400 kg/m3)
- m2 per-unit glass
- Transport A4 stage inclusion
- Warning on missing A4 factor
- Warning on m3 without density
- Industry benchmarks (recycled rebar vs virgin steel, CLT vs EPS)

### Data sources

- ICE Database v3.0 (University of Bath) — adapted methodology, UK-sourced GWP values
- BS EN 15978:2011 — lifecycle stage naming convention
- RICS Professional Statement 2017 — boundary definitions

---

## Workstream 4: Multi-Industry (P0)

**Status: Partial — PPN 006 CRP complete; onboarding industry select in progress**

### What was built

- **PPN 006 CRP report template** (`lib/reports/templates/ppn-006-crp.ts`) — full HTML PDF template: cover page with branding, KPI row (Scope 1/2/3 + baseline delta), commitment statement, emission breakdown table, targets table, attestation/sign-off block.
- **Report type `ppn_006_crp`** added to `ReportType` enum, migration, worker dispatch, report form, and reports page.
- **Worker handler** — builds `CrpScopeRow[]` from calculation aggregates, reads targets from `opts` JSON, supports signatory name/title/date, net zero year, methodology notes.
- **Organization model** already has `industry String?` field — ready for onboarding selector.

### Pending (next sprint)

- Industry selector on org creation/settings onboarding step
- Industry-specific dashboard widget variants (construction: embodied carbon summary; logistics: tCO2e/tonne-km; FM: building energy; public bidder: PPN 006 CRP status indicator)

---

## Workstream 2: Supplier Portal (P0)

**Status: Complete**

### What was built

- **`supplier` OrgRole** — added to Prisma enum; explicitly excluded from `ROLE_GROUPS.anyMember` (security invariant).
- **`SupplierInvite` model** — magic-link invites scoped to org; token (unique), expiresAt, usedAt, usedByUserId.
- **Migration `20260824000000_supplier_portal`** — `ALTER TYPE org_role ADD VALUE 'supplier'`; `supplier_invites` table; `submitted_by_user_id` on `epd_records`.
- **`POST /api/auth/accept-supplier-invite`** — rate-limited (5/15 min); validates token/expiry/usedAt; finds-or-creates user; atomically marks invite used + creates 30-day session via `prisma.$transaction`.
- **`GET/POST /api/orgs/[orgId]/supplier-invites`** — admin only; list pending/accepted/expired invites; create invite with email + companyName + expiresInDays.
- **`DELETE /api/orgs/[orgId]/supplier-invites/[inviteId]`** — admin only; 409 if already accepted.
- **`GET/POST /api/orgs/[orgId]/supplier-portal/epds`** — suppliers see only their own via `submittedByUserId` filter; admins/editors/reviewers see all.
- **Audit log actions:** `supplier_invite.created`, `supplier_invite.revoked`, `supplier_invite.accepted`, `epd.submitted`.
- **Tests (`lib/supplier/__tests__/supplier-invite.test.ts`)** — 8 tests: accept valid invite, create new user, reject expired, reject already-used, reject bad token, cross-tenant isolation, `supplier` in OrgRole, `supplier` NOT in `ROLE_GROUPS.anyMember`.

---

## Workstream 3: ERP Integration (P1)

**Status: Scaffold shipped**

### What was built

- **`IntegrationConnection` model** — stores OAuth tokens, scopes, external account info per org/provider; unique on `(organizationId, provider)`.
- **Migration `20260824000001_integration_connections`** — `integration_connections` table with cascade-delete.
- **`GET /api/orgs/[orgId]/integrations/xero`** — returns `{ connected, connectedAt, accountName, scopes, tokenExpired }`.
- **`POST /api/orgs/[orgId]/integrations/xero`** — builds Xero OAuth2 authorization URL with `state = base64(orgId)`; returns `{ authUrl }` for client redirect.
- **`DELETE /api/orgs/[orgId]/integrations/xero`** — disconnects; writes `integration.disconnected` audit log.
- **Audit log actions:** `integration.connected`, `integration.disconnected`.

### Pending (next sprint)
- OAuth callback route `GET /api/auth/xero/callback` — exchange code for tokens, persist to `IntegrationConnection`.
- pg-boss sync job — pull Xero bills/purchase orders → `ActivityRecord` staging.
- Category mapping UI.
- "Integrations" settings page with connection status widget.

---

## Security Notes

All new endpoints follow existing patterns:
- `requireOrgMember()` on every org-scoped route
- `organizationId` scoped in all queries
- `apiError()` returns generic codes (no tenant data leakage)
- Audit log entries written on embodied carbon record creation
- Materials API requires a valid session (no unauthenticated access)

See `test-reports/infrastructure-findings.md` for outstanding security findings (FIND-001 through FIND-008).
