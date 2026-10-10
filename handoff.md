# MetricOra Handoff

**Updated:** 2026-10-11
**Repo:** `Real-Sahil/CarbonSite`. Product MetricOra, site metricora.co.uk. Everything below is on `main`.
**Supersedes:** the 2026-09-28 version (launch film, nav, ERP profiles; all shipped, detail in `docs/dev/features/`).

---

## 1. Start a new session this way (keeps the context small)

Long chats cost tokens because every call re-reads the whole context. A fresh session starts at about 25k tokens instead of several hundred thousand.

1. Start a new session and say: "Read handoff.md and continue with section 3, item N."
2. Do not read other files up front. `CLAUDE.md` (about 14k tokens) loads by itself and points to `docs/dev/features/*.md`; open only the file for the area you are changing.
3. Work in one task per session. When the task is merged, end the session; start a new one for the next task.
4. Compact at a task boundary, never mid-task. Do not switch model mid-session. Pipe long command output through `tail` or `grep`; send research and log reading to a subagent.
5. Check the habit: `pnpm tokens` reports context per call, cache rewrites and the tools that fill the context. Standards: `docs/dev/TOKEN_STANDARDS.md`.

**Standing rules** (also in `CLAUDE.md`): replies in caveman style; code, commits and docs in normal prose; after lint, knip, typecheck, tests and build pass, merge to `main` without asking; no Docker, no paid subscriptions; no PR unless asked; UK English, no em dashes in copy, no unverified claims.

**Local main may be stale in a new container.** Run `git fetch origin main && git checkout -B work origin/main` before starting.

---

## 2. Tooling state

| Tool | State |
|---|---|
| ponytail, superpowers, graphify | Enabled in `.claude/settings.json`; graphify rebuilds its graph at session start. |
| `autoCompactWindow` | `250000` in `.claude/settings.json`. **Unconfirmed:** the cloud environment sets `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80`, which may win. Check with `pnpm tokens` after a long session; if the context passes 250k without a compaction, edit the environment variable. |
| **squeez** (Bash output compressor) | **Not installed.** The install was blocked in the last session (it edits Claude Code hooks, which the safety classifier refused). It is now a step in `scripts/dev-tools/install-agent-tools.sh`. To enable: run `bash scripts/dev-tools/install-agent-tools.sh` yourself, or paste the script into the cloud environment's setup script, then restart the session. Baseline first: run `pnpm tokens` on a long session, enable, repeat, and keep it only if the tool-output line drops. Its savings figure (up to 95%) is the project's own claim. Do not add RTK beside it (two Bash wrappers). |
| context7 MCP | In the install script; **failed to connect in the last session** (proxy 403). Needs the host allowed in the environment's network access. |
| Evaluated, not installed | claude-mem (hosted memory), headroom (reroutes all traffic through a proxy), skill catalogues (context cost), a second code-retrieval MCP (graphify already covers it; each MCP's tool list adds startup tokens). |

---

## 3. Open items, in suggested order

1. **Pay the ICO data protection fee** before go-live (MetricOra has no registration yet). Owner action.
2. **Solicitor review** of `docs/legal/POLICY_DRAFTS.md` (AI statement, calculation disclaimer, disclosure and safe harbour, retention schedule, special-category DPA addendum). Security contact is hello@metricora.co.uk. Nothing from it is published.
3. **Fix the live Terms page:** it names SustainMetrics (not loaded) and says DEFRA 2025 where 2026.1 is current. Bump `TERMS_VERSION` in `lib/legal/terms.ts` with the page.
4. **Build the three retention items the drafts promise:** audit-log anonymisation job, field-worker data deletion, retention job. None exists yet. The audit log is a hash chain, so anonymise by redacting metadata fields, not by deleting rows; read `lib/audit/chain.ts` first.
5. **Browser-check MapLibre 6** (upgraded to 6.4.1 for advisories; unit tests pass, never viewed in a browser). Set `NEXT_PUBLIC_MAP_STYLE_URL` for tiles.
6. **Security scans not yet run:** Semgrep (blocked by the environment proxy) and Strix (needs Docker and an LLM key). OSV-Scanner and `pnpm audit --prod` cover dependencies; two advisories have no fix (node-forge, sprintf-js), listed in `SECURITY.md`.
7. **Flutter:** `fuel_log_screen.dart` and other screens written without a Flutter SDK; run `flutter analyze` and a device check before the next release.
8. **Real-document check:** run real carrier transfer notes through the inbox and read the edit counts before trusting the reader; the corpus is synthetic.
9. **iOS app** is in App Store review (version 1.0.9 waiting on 6 October 2026). Do not link or claim it until approved.
10. **Quarterly rechecks:** regulatory calendar `LAST_CHECKED` (4 October 2026), US disclosure rules, factor libraries (data-upkeep issues arrive weekly).

---

## 4. What happened in the last session (2026-10-09 to 10-11)

- **Site filtering:** a true `siteId` filter on the dashboard, records list and saved views; sortable "Compare all sites" table; project sites can hold their own latitude and longitude (migration `20261010000091`).
- **Security:** production advisories cleared (68 down to 2 unfixable); `@xmldom/xmldom` pinned to 0.8.15 because 0.9 breaks SAML; next 16.3.8, maplibre-gl 6.4.1.
- **Terms of Service** mandatory at sign-up (checkbox, server gate, recorded version) and an accept page for every account without the current version (invites, SSO, supplier, bulk, existing). The API is not gated, so installed mobile builds keep working.
- **Token work:** `pnpm tokens` report, `docs/dev/TOKEN_STANDARDS.md`, CLAUDE.md trimmed from about 50k to about 14k tokens with feature detail moved to `docs/dev/features/`, auto-compact window set.
- **Measured finding:** cost was context size (median 436k tokens per call), not output. Cache reads were 98% of input.
- Log noise: the slow-load log is `info`, and a warning only at 3x the threshold.

---

## 5. Environment limits (cloud container)

- Outbound network is restricted by policy; hosts are allowed in the environment's network access settings. Failed to connect last session: `context7`, `mobbin`, `supabase` (proxy 403), `stripe` (needs authorising in claude.ai connector settings).
- No `gh` CLI; use the GitHub MCP tools. Vercel and GitHub MCP work.
- Deployment is Vercel only; jobs run inline through `lib/jobs/dispatch.ts`; scheduled work is Supabase pg_cron. Details in `CLAUDE.md`.
- Env vars do not persist between shell commands; the scratch Postgres needs `service postgresql start` in a new container.

---

## 6. Settled decisions

Detail in `docs/dev/features/decisions.md`. Short form: Supabase Postgres and Storage; per-organisation billing (Starter £99, Growth £299, Enterprise from £750 a month; 30-day trial; Essentials £199 a year); GHG Protocol report is the default; methodology bumps only for rule changes that alter a figure; factor loading is manual, CPI by pull request; group model is one organisation per reporting group.
