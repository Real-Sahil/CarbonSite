# MetricOra Handoff

**Updated:** 2026-09-28
**Repo:** `Real-Sahil/CarbonSite` (GitHub). Product name MetricOra, site metricora.co.uk.
**Working branch:** `claude/review-handoff-docs-gpjlvd` (fast-forwarded from `claude/review-handoff-docs-woi4zm`, which it contains)
**Supersedes:** the 2026-08-24 version of this file (it described Neon, Cloudflare R2, a cyan palette and open billing/report decisions; all of that is out of date).

---

## 1. How to resume

1. Read this file, then `CLAUDE.md`. `CLAUDE.md` is the source of truth for architecture, conventions, data sources, security guards and every shipped feature. This file only holds session state and open items.
2. Check out the working branch and sync:
   ```bash
   git fetch origin main claude/review-handoff-docs-gpjlvd
   git checkout claude/review-handoff-docs-gpjlvd
   git status && git rev-list --left-right --count origin/main...HEAD
   ```
   Expected at handoff: clean tree, branch **4 commits ahead** of `origin/main` (see section 2).
3. Pick up at section 4 ("Waiting on the user"). Nothing is half-built; every item there is a proposal awaiting a yes/no.

**User's working preferences**
- Replies in caveman style, always (standing instruction, also in `CLAUDE.md` > Working agreement). Code, commits and docs are written normally.
- No em dashes anywhere in copy (taste-skill ban).
- Marketing claims: only real product, demo tenant data labelled as demo, no invented customers, metrics, testimonials or logos (see `CLAUDE.md` > Marketing site).
- Commit and push to the working branch, then always merge to `main` once lint, typecheck, tests and build pass (standing instruction from 2026-09-28; no need to ask). No PR unless asked.

---

## 2. Repository state

| Item | State |
|---|---|
| `origin/main` head | `9d8128ce` Home page hero: the launch film |
| Working branch head | ERP export profiles commit (on top of the marketing nav commit) |
| Not yet on `main` | `fff01c56` hero H1 "Carbon figures you can prove.", the handoff rewrite, the marketing nav commit (4A), and ERP export profiles with this handoff update (4B item 1, migration `20260928000053`) |
| Open PRs | Dependabot only (#27-#33 Flutter, #89 dev deps, #90 production deps, 49 updates) and #60 "ECC bundle" (third-party, stale since 2026-09-04). None from this work. |
| Deploy | Vercel production READY for `9d8128ce`; CI, migrations and CodeQL passed. |

**Settled 2026-09-28:** the owner said to always merge to `main`. PR #92 (nav, ERP export profiles, CI mobile change) was merged on 2026-09-28 after green CI; merge through a PR with the GitHub tools, not a direct push to `main`.

---

## 3. What happened in the last session (2026-09-26 to 09-28)

### 3.1 Launch film (done, live)
- 56 s Remotion film in `videos/` (own npm package; rules in `videos/BRAND.md`, story in `videos/launch-prompt.md`, beat sheet `videos/src/videos/launch/BEAT-SHEET.md`). Original score from `videos/scripts/compose.py`.
- Story: open lockup, "Carbon figures that hold up / when someone checks them.", field app fuel receipt (Certas Energy, 520 L HVO, OCR of 4 fields), review and approve, trace from FY2025 total 4,710.05 tCO2e to 520 L x 0.03558 = 18.50 kg CO2e (DEFRA 2025.2, Verified), three documents (CRP, SECR, GHG Protocol), assurance pack, end lockup with "Start your Carbon Reduction Plan". All figures are the demo tenant (Northgate Civils Ltd).
- Screens are redrawn in code from demo screenshots with the product's tokens, not captured.
- Web encodes in `public/marketing/film/`: `launch-720.webm` (1.6 MB loop), `launch-720.mp4`, `launch-1080-sound.webm` (6.1 MB), `launch-1080-sound.mp4`, `poster.jpg`. Encoder settings (x264 `tune film`, `aq-mode 3`, no deadzones; VP9 without scaler dither) fixed banding streaks; they live in `videos/scripts/render.ts`.
- Re-render: `cd videos && npm run setup && npm run render`, copy outputs into `public/marketing/film/`.

### 3.2 Home hero (done)
- `components/marketing/launch-film.tsx`: muted 720p loop while on screen (IntersectionObserver, poster only under reduced motion); "Play with sound" swaps to the 1080p cut inside the click (`flushSync`) so the browser allows audio.
- `app/(marketing)/page.tsx`: film replaces the dashboard screenshot; H1 changed so it no longer repeats the film's opening words (commit `fff01c56`, branch only).

### 3.3 Tools set up this session (container only, lost when the container is reclaimed)
- **Agent-Reach** installed in `~/.agent-reach-venv` (check-only mode). Only RSS and Jina Reader channels are usable, and Jina (`r.jina.ai`) is blocked by the environment network policy. Reinstall: `python3 -m venv ~/.agent-reach-venv && ~/.agent-reach-venv/bin/pip install https://github.com/Panniantong/agent-reach/archive/main.zip`.
- **TinyFish MCP** (claude.ai connector) works for outside websites the container cannot reach. Use `fetch_content` for page text and `run_web_automation` for computed styles (slow, several minutes, can drop).

### 3.4 Glean.com design scan (research, no code)
Captured via TinyFish: full nav tree and page hierarchy. Not captured: computed colours, fonts, button styles (the automation run was lost when TinyFish disconnected). Only confirmed colour: Glean blue `#343CED`.
Key patterns: 5 top items (Product, Customers, Solutions, Resources, Company); mega menus with name + one-line benefit per link; Solutions split into Departments and Industries; one content card per menu (quiz, report); single primary CTA "Get a demo" repeated in nav, hero, final CTA and footer.

---

## 4. Waiting on the user (next actions, in order)

### A. Marketing nav and hero changes from the Glean scan (proposed, not started)
Keep MetricOra's palette (graphite, off-white, ember accent, Geist). Changes, all in `components/marketing/site-nav.tsx` (`NAV`) and `app/(marketing)/page.tsx`:
1. Solutions gets a "By document" column: Carbon Reduction Plan (PPN 006), SECR, PPN 026 social value, bid carbon pack.
2. One real content card per dropdown: Platform → "Start your Carbon Reduction Plan" (`/sign-up?start=crp`); Solutions → "PPN 026 applies from 1 January 2027"; Resources → regulatory calendar. Hidden in the mobile menu.
3. Add Management systems (ISO 14001/9001/45001, registers, PQQ/CAS, certification pack) to the Platform menu. Currently missing from the nav.
4. One primary CTA everywhere: "Start a 30-day trial"; "Book a pilot" secondary, hero only.
Skip: logo wall, customer metrics, testimonials, live counters (claims rules).
**Status:** DONE 2026-09-28 (commit "Marketing nav: documents column, one card per menu, management systems"). Changes from the proposal: there is no public regulatory calendar page, so the Resources card links the "Planning a first reporting period" guide instead; closing CTAs keep the pilot as a text link ("Or book a pilot") because their copy mentions pilots; /product gained a `#management-systems` section as the menu's target (no screenshot; none captured yet). Checked at 1024 and 1440 px: no menu overflows.

### B. ERP and CRM data integration (proposed, not started)
Current code: Xero is a real connector (`lib/integrations/xero.ts`); QuickBooks and Sage are 35-line stubs (`lib/integrations/{quickbooks,sage}.ts`, connectors in `lib/connectors/`); `lib/connectors/ingest.ts` turns connector output into the normal import (review then commit). No SAP, Causeway, COINS, Dynamics, NetSuite, Salesforce or HubSpot code (SAP/NetSuite exist only as options in the pilot kit form).
Recommended order:
1. **ERP export profiles** (first build): saved column mapping per source system plus a ledger account / cost code → emission category rule table (the missing piece), templates for SAP, Causeway Financials, COINS, Sage. Data arrives by upload, the ingest API/webhook, or n8n/Zapier. Covers every ERP with no partnerships.
2. Finish QuickBooks and Sage; consider a unified accounting API (Codat/Merge) for NetSuite and Dynamics 365 Business Central (paid, conflicts with the no-paid-subscriptions rule).
3. Native SAP (S/4HANA OData) and Causeway only when a customer funds it. Causeway public API availability is **unverified**; likely needs their partner programme.
4. CRM last: only useful to pull won deals into Contracts.
Marketing may name only systems that work end to end (today: Xero, plus "any ERP by export").
**Status:** item 1 DONE 2026-09-28 (see `CLAUDE.md` > ERP export profiles). Verified: unit tests, cross-tenant tests, all migrations replayed on Postgres 16 with zero drift, and the worker run end to end on a Sage-style ledger CSV. Not verified: the profile editor page in a signed-in browser (needs a seeded tenant), and the templates' header names against real SAP/Causeway/COINS/Sage exports (ask a pilot customer for a sample). Known limit: credit notes are left out with a warning, not netted, so a period with credits overstates spend until someone nets them. Next: items 2 to 4 need a go.

### C. Merge to `main`: DONE 2026-09-28 (PR #92).

---

## 5. Environment and access limits (this cloud environment)

- Outbound network is restricted by policy. Blocked when tested: `www.glean.com`, `r.jina.ai`. To allow a host, the user edits the environment (session title bar → environment → Edit → Network access).
- MCP servers failing to connect this session: `supabase` and `stripe` (proxy tunnel 403), `graphify` (timeout). Vercel and GitHub MCP work. No `gh` CLI; use GitHub MCP tools.
- Deployment is Vercel only; jobs run inline through `lib/jobs/dispatch.ts`; scheduled work is Supabase pg_cron. Details in `CLAUDE.md`.

---

## 6. Settled decisions (were "pending" in the old handoff)

| Topic | Decision | Where |
|---|---|---|
| Database / storage | Supabase Postgres + Supabase Storage (bucket `carbonsite`); no Neon, no R2 account | `CLAUDE.md` Stack |
| Billing | Per organisation: Starter £99/mo, Growth £299/mo, Enterprise from £750/mo; 30-day trial; Stripe live and sandbox wired | `CLAUDE.md` Decisions 3 |
| Report format | Customer-facing GHG Protocol report by default; CSV calculation trail on every emissions report | Decisions 4 |
| Methodology versioning | Bump only for rule changes that alter a figure; policy in `lib/calculation/methodology.ts` | Decisions 2 |
| Factor updates | Weekly data-upkeep watchers open issues; loading stays manual; CPI by PR | `CLAUDE.md` Data upkeep |
| Field app | Android live on Google Play; iOS in App Store review (do not link or claim it) | `CLAUDE.md` Marketing site |
| Marketing design | Graphite / off-white / ember accent, Geist, `components/marketing/kit.tsx` | `CLAUDE.md` Marketing site |

Still open: data retention policy (audit logs, calculations, reports) has no written policy.

---

## 7. Shipped recently on `main` (newest first, for orientation)

Launch film and hero · commuting survey in miles · field app hazard reports and site inspections · management systems (16 frameworks, registers, document control, training matrix, certification pack and auditor links, integrated view, ISO 14001/9001:2026 transition) · PQQ answer library (Build UK CAS v5 and client PQQs) · dashboard queries 85 → 51 · Find a Tender import and watch · data upkeep automation · ESRS E5 from waste records · reports use org commitments, CBAM withdrawn · AI assistance (Groq then Mistral, admin opt-in) · invite link fixes for iPad/App Store review · commuting from attendance · Tesseract OCR on Vercel · assurance pack ZIP · bill inbox and bill matching · PPN 026 field capture · failed-payment handling.
Full detail for each is in `CLAUDE.md`.
