# Security

This document tracks security-relevant architectural decisions for MetricOra. It is a living reference, not a finished policy — expanded incident-response, breach-notification, and DSAR-handling sections land here as that work progresses.

## Authorization model

The enforced access-control layer is application code, not the database:

- `requireOrgMember(orgId, ...roles)` and `requirePlatformMember()` in `lib/auth/session.ts` are called explicitly on every org-scoped and platform-scoped route handler. This is the real, tested authorization boundary.
- Postgres Row-Level Security policies exist in `prisma/migrations/rls_policies.sql` and `add_remaining_rls_policies.sql` but are **not an enforced control**. They key off `auth.uid()`, a Supabase-style session-variable convention this Better Auth + Prisma stack never populates — no request path issues the `SET LOCAL`/`set_config` call needed to set it, and the Prisma connection role's `BYPASSRLS` status is unconfirmed. As written, these policies are inert: kept in the repo as a documented starting point, not cited as an active layer.

**Do not represent RLS as a live control for this app's own request flow** in a security questionnaire, audit response, or compliance document. If this is revisited, wiring it up properly requires: the app DB role running without `BYPASSRLS`, and every request setting the session variable inside a transaction-scoped `SET LOCAL` (given the pooled connection client in `lib/db/index.ts` — a bare `SET` would leak across reused pooled connections).

That said, RLS still matters as a second, independent surface: this project's Postgres instance is Supabase-hosted, which means PostgREST — a REST API generated directly over the schema — is reachable at the project's default URL, and Supabase Auth (a separate service from this app's own Better Auth) can issue JWTs to anyone who signs up through it, entirely outside this codebase. `rls_policies.sql` grants `authenticated` blanket `SELECT/INSERT/UPDATE/DELETE` on every table in `public`; RLS is the *only* thing standing between that grant and a caller reading or writing arbitrary rows via PostgREST. A 2026-08-25 Supabase linter scan found 17 tables added after the original RLS pass had **no RLS enabled at all** (not inert policies — disabled outright), including `integration_connections` (holds OAuth `access_token`/`refresh_token`) and `supplier_invites` (holds a bearer invite `token`). Fixed in `prisma/migrations/20260825153826_enable_rls_missing_tables/` and `20260825154500_enable_rls_new_tables/` (two tables created after the first fix — `supplier_data_requests`, `dsar_requests` — needed the same treatment on the next scan) — same `is_org_member_for_rls(organization_id)` pattern as the original migration, safe because the app's own Prisma connection authenticates as the `postgres` role (confirmed via `DATABASE_URL`, and confirmed via `pg_roles.rolbypassrls = true` on the live project), which bypasses RLS by Supabase default; only the PostgREST/Supabase-Auth surface is affected. Since `organization_membership.user_id` values are Better Auth IDs and never match a Supabase Auth UID, these policies are effectively deny-all for that surface — the correct outcome, since no legitimate caller should be reaching these tables through PostgREST at all. Verified clean via the Supabase advisor (`mcp__supabase__get_advisors`, type `security`) — zero `rls_disabled_in_public` or `sensitive_columns_exposed` findings remain; the only RLS-related results left are informational (`rls_enabled_no_policy` on the three intentionally deny-all tables).

**When adding a new table**, enable RLS in the same migration that creates it — don't rely on a later audit catching the gap.

**Remaining lower-severity findings from the same scan** (not fixed here, flagged for a follow-up): four pg-boss internal functions (`pgboss.job_table_format`/`job_table_run`/`job_table_run_async`/`create_queue`) have a mutable `search_path` — pre-existing, part of the pg-boss extension itself, not app code. `is_org_member()`/`is_org_member_for_rls()` are `SECURITY DEFINER` functions callable via PostgREST RPC by `anon`/`authenticated` — they only return a boolean and don't leak row data, but tightening would mean revoking public `EXECUTE` or switching to `SECURITY INVOKER`.

**Migration tracking note**: this project has schema drift between Prisma's own `_prisma_migrations` bookkeeping table and what's actually applied — several migrations reached production through Supabase's own tooling (dashboard/MCP `apply_migration`) under different names/timestamps than the local migration folder, and Prisma's table didn't know about them. Resolved by reconciling `_prisma_migrations` against actual DB state (checked `information_schema` for each pending migration's target objects before applying) rather than blindly running `prisma migrate deploy`, which would have repeated the `P3009`/`42P07` failure from earlier. If this happens again: check `_prisma_migrations` for unfinished rows first, then check whether the target objects already exist before deciding to apply vs. mark-resolved.

## Audit log

`writeAuditLog()` (`lib/db/audit.ts`) writes an append-only, tamper-evident record of security- and business-relevant events:

- **Hash chain**: each row's `hash` covers its own fields plus the prior row's `hash` (`previousHash`), scoped per organization. Writes are serialized per-org via a Postgres advisory lock so concurrent audit events can't fork the chain. `verifyAuditChain(organizationId)` recomputes the chain and returns the index of the first broken link, or `null` if intact — rows written before the hash chain was introduced have `hash = null` and are skipped (unverifiable, not evidence of tampering).
- **IP / user-agent capture**: `middleware.ts` resolves the proxy-aware client IP (`resolveClientIp()`, walking `X-Forwarded-For` past trusted proxies) and forwards it as `x-client-ip` on every request. `writeAuditLog()` reads this — and the `user-agent` header — automatically via `next/headers` when a call site doesn't pass `ipAddress`/`userAgent` explicitly, so no route handler needs to thread these through by hand. Call sites outside a request scope (pg-boss workers) get `null` unless they pass the values explicitly.

## Patch management

- Dependabot (`.github/dependabot.yml`) covers npm, Flutter (`pub`), and GitHub Actions dependencies on a weekly cadence.
- `pnpm audit --prod` runs in CI (`.github/workflows/ci.yml`), currently non-blocking (`continue-on-error: true`) while the existing advisory backlog is triaged — tighten once clean.
- CodeQL security-extended scanning (`.github/workflows/codeql.yml`) runs on push/PR to `main` and weekly.

## Open items

See the MetricOra UK regulatory/security compliance plan (Track A) for the full roadmap: DSAR export/erasure, MFA, account lockout, CSP nonce migration, field-level encryption for GPS/postcode data, monitoring/alerting, and the documentation/DPA workstream this file will absorb over time.
