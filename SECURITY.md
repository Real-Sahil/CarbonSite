# Security

This document tracks security-relevant architectural decisions for CarbonSite. It is a living reference, not a finished policy — expanded incident-response, breach-notification, and DSAR-handling sections land here as that work progresses.

## Authorization model

The enforced access-control layer is application code, not the database:

- `requireOrgMember(orgId, ...roles)` and `requirePlatformMember()` in `lib/auth/session.ts` are called explicitly on every org-scoped and platform-scoped route handler. This is the real, tested authorization boundary.
- Postgres Row-Level Security policies exist in `prisma/migrations/rls_policies.sql` and `add_remaining_rls_policies.sql` but are **not an enforced control**. They key off `auth.uid()`, a Supabase-style session-variable convention this Better Auth + Prisma stack never populates — no request path issues the `SET LOCAL`/`set_config` call needed to set it, and the Prisma connection role's `BYPASSRLS` status is unconfirmed. As written, these policies are inert: kept in the repo as a documented starting point, not cited as an active layer.

**Do not represent RLS as a live control** in a security questionnaire, audit response, or compliance document. If this is revisited, wiring it up properly requires: the app DB role running without `BYPASSRLS`, and every request setting the session variable inside a transaction-scoped `SET LOCAL` (given the pooled connection client in `lib/db/index.ts` — a bare `SET` would leak across reused pooled connections).

## Audit log

`writeAuditLog()` (`lib/db/audit.ts`) writes an append-only, tamper-evident record of security- and business-relevant events:

- **Hash chain**: each row's `hash` covers its own fields plus the prior row's `hash` (`previousHash`), scoped per organization. Writes are serialized per-org via a Postgres advisory lock so concurrent audit events can't fork the chain. `verifyAuditChain(organizationId)` recomputes the chain and returns the index of the first broken link, or `null` if intact — rows written before the hash chain was introduced have `hash = null` and are skipped (unverifiable, not evidence of tampering).
- **IP / user-agent capture**: `middleware.ts` resolves the proxy-aware client IP (`resolveClientIp()`, walking `X-Forwarded-For` past trusted proxies) and forwards it as `x-client-ip` on every request. `writeAuditLog()` reads this — and the `user-agent` header — automatically via `next/headers` when a call site doesn't pass `ipAddress`/`userAgent` explicitly, so no route handler needs to thread these through by hand. Call sites outside a request scope (pg-boss workers) get `null` unless they pass the values explicitly.

## Patch management

- Dependabot (`.github/dependabot.yml`) covers npm, Flutter (`pub`), and GitHub Actions dependencies on a weekly cadence.
- `pnpm audit --prod` runs in CI (`.github/workflows/ci.yml`), currently non-blocking (`continue-on-error: true`) while the existing advisory backlog is triaged — tighten once clean.
- CodeQL security-extended scanning (`.github/workflows/codeql.yml`) runs on push/PR to `main` and weekly.

## Open items

See the CarbonSite UK regulatory/security compliance plan (Track A) for the full roadmap: DSAR export/erasure, MFA, account lockout, CSP nonce migration, field-level encryption for GPS/postcode data, monitoring/alerting, and the documentation/DPA workstream this file will absorb over time.
