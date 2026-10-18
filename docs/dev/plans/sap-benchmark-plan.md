# SAP benchmark: reassessment and implementation plan

Status: proposal. Nothing here is built. Source of the SAP side: public SAP pages and partner write-ups (marketing material, so verify against SAP's Help Portal before relying on any detail). No SAP code, binaries or licensed content is used or copied; the only things adopted are open standards (WBCSD PACT, GHG Protocol).

## 1. Reassessment: what MetricOra already has

Checked against the code on `main` (a7840b1d). The first pass overstated the gaps.

| SAP module | MetricOra today | Verdict |
|---|---|---|
| Sustainability Footprint Management (Scope 1/2/3, factors, Sankey) | Calculation engine, DEFRA/EPA/ADEME/USEEIO libraries, `DashboardAggregate`, Sankey in `lib/charts/sankey.ts` with reconciliation tests | At par or ahead on auditability. SAP leads on factor count only. No action. |
| Sustainability Data Exchange (supplier PCF) | `SupplierDataRequest`, public supplier portal, `lib/connectors/pact-pcf-connector.ts` (PACT spec 2.2.0, simplified), `supplier-portal/pact-import` and `pact-export` routes, EPD routes | Partly built. Gaps: older spec version, no stored PCF record (import turns into activity records only), no standard Pathfinder HTTP API. |
| Sustainability Control Tower (ESG targets and KPIs) | `ReductionTarget`, `SbtiTarget`, `SocialValueTarget`, targets page, ESRS E1 pages | Carbon and social value covered. Wider ESG KPIs not audited. |
| Green Ledger (carbon next to finance) | `lib/ledger/` (Xero line suggestions), accounting sync, spend-based Scope 3 | Partial. No carbon-by-GL-account view. |
| EHS, Responsible Design and Production, Product Compliance, Green Token | Waste, permits, management systems, embodied carbon, EPD routes | Different product areas. Out of scope. |

## 2. Principles (how the plan avoids breaking anything)

1. Additive only. New tables, routes and files. No change to existing routes, response shapes or stored figures.
2. No change to any calculated figure. Methodology version stays. `report-dashboard-reconciliation.test.ts` and `tests/golden/*` must pass unchanged on every phase.
3. Migrations follow `migrate.yml` rules: additive, guarded Supabase SQL, RLS enabled with deny-all policy, `prisma migrate diff` baseline stays 0.
4. New behaviour sits behind an org-level opt-in or a feature flag, off by default.
5. Org scope on every query, `orgRefsError()` on every id taken from a request, `writeAuditLog()` on every write.
6. Each phase merges on its own and can be reverted alone. No phase depends on a later one.
7. CI gate before each merge: `pnpm lint && pnpm knip && pnpm typecheck && pnpm test && pnpm build`.

## 3. Phases

### Phase 0: baseline (no code)
Run the full CI gate on `main` and record results. Read `docs/dev/features/platform-services.md` and `reporting-and-compliance.md`. Confirm the current PACT spec version at wbcsd.github.io before Phase 1 (SAP states PACT V3; confirm before coding).
Exit: green baseline recorded in the PR description.

### Phase 1: PACT version tolerance
Change: `lib/connectors/pact-pcf-connector.ts` detects the payload's spec version and parses current and 2.2.0 shapes; the existing 2.2.0 path stays byte-for-byte compatible. Add fixture payloads for both.
Files: the connector, its test, `pact-import/route.ts` only if the schema export is needed.
Why safe: old payloads take the old path; tests prove it.
Rollback: revert one commit.

### Phase 2: stored product footprint record
Change: new table `ProductCarbonFootprint` (organization_id, supplier link, product id and name, declared unit, PCF excluding and including biogenic, validity period, spec version, source, payload checksum, verification note). Import writes the new row in addition to the activity records it already creates.
Files: `prisma/schema.prisma`, additive migration with RLS deny-all, import route, audit event, `docs/dev/features/platform-services.md`.
Why safe: existing outputs unchanged; the new table is read by nothing until Phase 3 or 4.
Test: cross-tenant write test added to `tests/security/cross-tenant-writes.test.ts`.

### Phase 3: PACT-conformant read API (optional, needs a demand signal)
Change: Pathfinder-style endpoints (token, list footprints, get footprint, events) under a new path, read-only, org API key, rate limited, off unless an org enables it. Publishes only data the org marked shareable.
Why safe: new routes only. Check conformance with the public PACT test suite before announcing.
Open question for the owner: is a buyer asking for this? If not, stop after Phase 2.

### Phase 4: supplier PCF as a factor source (owner decision)
Change: let a record use a stored supplier PCF instead of the spend-based factor, per record, opt-in.
Risk: this changes figures for records that opt in. Rules: no automatic switching; show a before/after diff before publish; never rewrite a published snapshot; decide with the owner whether this needs a methodology bump (the project rule says only rule changes that alter a figure from the same records and library do). Do not start without that decision.

### Phase 5: carbon by GL account (read-only)
Change: report view joining stored calculations to the ledger-line mapping from `lib/ledger/`, showing tCO2e and carbon per unit of spend by account. No write to Xero or any ledger.
Why safe: read-only query over existing tables, new page, `DashboardAggregate` untouched.

### Phase 6: ESG KPI gap audit (no build)
Compare targets and ESRS pages with SAP's Control Tower scope. Output a short list; build nothing until picked.

### Deferred
Product-level (SKU) footprint allocation, SAP-style EHS and product compliance modules, factor library expansion (each library needs a licence check recorded in `docs/THIRD_PARTY_SOURCES.md`).

## 4. Order and value

Phase 1 and 2 are the useful core: they make supplier data durable and standard-conformant at low risk. Phase 5 is the cheapest visible win. Phase 3 and 4 wait for a customer or owner decision.

## 5. Verification per phase

- Unit tests for new parsing and mapping; fixture payloads only, no customer data.
- Cross-tenant write test for each new table.
- `lib/completeness/__tests__/fix-paths.test.ts` stays green for any new "missing" message.
- Build check; for routes that touch OCR, the `.nft.json` rule in `CLAUDE.md` is not triggered by this plan.
- Review the diff for any change to existing response shapes.

## 6. Not verified

SAP feature details come from marketing and partner pages. The PACT version and Pathfinder API shape must be confirmed against the standard before Phase 1. No benchmark of SAP behaviour was run.
