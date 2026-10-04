# Portal experience: design proposal

Status: scope agreed 4 October 2026, phase 0 complete, phase 1 next. No application code has been written; nothing here changes behaviour until a phase merges.

## Decisions taken

- Shared team views are in scope from phase 1, alongside personal views.
- Start with the main dashboard and the other pages where people work with field data and records: records, suppliers, field submissions and calculations. Further pages follow the same pattern after review.
- Phase 0 (data spike) approved and run; result below.
- First roles to design for are not yet named by the owner. Working assumption: sustainability manager or admin, and executive. Reviewer, auditor and field worker defaults follow, unchanged from today's RBAC.

## 1. Goal

Make the signed-in portal feel like a polished enterprise product (saved views, customisable dashboards, interactive charts, fast tables, maps, exports, assisted reporting) without weakening what makes MetricOra trustworthy: every figure comes from stored calculations, every tenant sees only its own data, and report totals equal dashboard totals.

## 2. Non-goals

- A general BI tool or a free-form query builder. Metrics and groupings are a fixed, reviewed list.
- Dummy or placeholder data anywhere. A widget with no data shows an honest empty state.
- Rewriting working pages. New patterns land on one page first and spread only after review.
- Changing calculation, snapshot or report logic.

## 3. Principles

1. **One source of truth.** Charts, tables, exports and reports read the same aggregates. A visual that cannot reconcile with the report does not ship.
2. **Server decides, client presents.** Filtering, sorting, role defaults and plan limits are enforced server-side; saved views only store a request, never data.
3. **Tenancy first.** New tables follow the existing rules: `organization_id`, RLS deny-all, ids checked with `orgRefsError()`, a tenancy test per route.
4. **Progressive enhancement, small bundles.** Heavy libraries load only on the page that uses them. Marketing pages stay static.
5. **Accessible by default.** Every drag, resize or hover interaction has a keyboard path. The axe gate stays green.
6. **Evidence over adjectives.** Each phase has exit criteria that can be measured.

## 4. Current state (verified in the repo)

Already installed: Radix primitives, TanStack Query and Table, Recharts, visx and d3-shape, Zod, `xlsx`, Puppeteer, `motion`.
Not installed: React Hook Form, Tiptap, MapLibre, react-grid-layout, dnd-kit, ECharts, cmdk.
No saved-view or dashboard-layout table exists.

`DashboardAggregate` is keyed by period, snapshot, scope, emission category, facility, business unit and Scope 2 method. It does **not** carry project, supplier or social value. The contract filter works today by turning a contract into a set of facility ids (`lib/dashboard/group-scope.ts`), and a drill-down route exists at `app/api/orgs/[orgId]/analytics/drill-down`.

Consequence: filtering and cross-filtering by supplier or project cannot be answered from aggregates as they stand. This is the main technical risk and is addressed first (phase 0).

## 5. Technology decisions

| Area | Decision | Reason |
|---|---|---|
| Components | shadcn/ui, Tailwind 4, Radix (keep) | Already the system. |
| Server state | TanStack Query (keep, deepen) | Already installed; gives caching, optimistic updates. |
| Tables | TanStack Table with server-side pagination, sorting, filtering, TanStack Virtual for large sets | Standard; pattern reference: sadmann7/tablecn (MIT). |
| Charts | visx and d3 as the single chart system; add `d3-sankey` and `d3-hierarchy`. Recharts stays until migrated. | No second heavy bundle; full control of palette; no ECharts or deck.gl. |
| Chart primitives | One shared kit: tooltip, legend, crosshair, brush, annotation, empty and loading states | Consistency and accessibility are built once. |
| Dashboard layout | react-grid-layout (MIT) for widget drag and resize | Responsive breakpoints built in. dnd-kit only for list reordering if needed. |
| Command palette | cmdk (MIT) | Small, standard. |
| Detail panels | react-resizable-panels | Master-detail without page loads. |
| Forms | React Hook Form with the existing Zod schemas, adopted for new forms only | Avoids a rewrite of working forms. |
| Rich text | Tiptap, report narrative only, after phase 4 | Reports render HTML through Chromium, so editor output must map to report templates. |
| Maps | MapLibre with a free tile provider whose terms permit application use | Facilities already carry coordinates. OSM's own tile servers must not be used. |
| AI | Existing `lib/llm` guard only: opt-in per organisation, no organisation names in prompts, `ungroundedNumbers()` rejection | The model explains figures; it never produces them. |

Reference-only (read for ideas, never copy code): OpenPanel (AGPL). Licences of other templates are checked before any borrowing.

## 6. Architecture

### 6.1 Saved view contract

One schema serves tables, dashboards and exports:

- identity: organisation, owner, name, surface (records, dashboard, suppliers and so on), scope (personal, shared, role default);
- request: filters, columns, sort, grouping, period or snapshot reference, layout (for dashboards);
- governance: role visibility, created and updated times, audit log entries for create, share and delete.

A saved view stores a **request**, not results. Ids inside filters (project, supplier, site, contract) are validated with `orgRefsError()` on write and again on read, because a referenced record can be deleted.

### 6.2 Widget registry

A server-side registry maps each widget type to: its data loader, required role, required plan feature, supported filters, and supported exports. The client can only place widgets the registry returns. A widget with no loader cannot exist, which removes the temptation to ship static numbers.

### 6.3 Data access

- Each page issues **one batched request** for all its widgets (Prisma runs one connection per function instance, so parallel widget fetches would run serially).
- Aggregates answer scope, category, site, business unit and contract questions today.
- Supplier, project and social value slices need a defined source (see phase 0). The options, in order of preference: extend the aggregate build with the new dimensions; add a second, separately rebuilt aggregate table for those dimensions; or answer them from `ActivityRecord` with a documented limit and an index plan. The choice is made from measurements, not assumed.

### 6.4 Exports

CSV and XLSX stream from the same request as the view. PDF reuses the existing Chromium report pipeline so figures match reports exactly; a dashboard screenshot is not an acceptable PDF export.

## 7. Delivery phases

Each phase merges independently, behind the existing role and plan checks, and has exit criteria.

**Phase 0: data spike. Done.**
Question: can supplier, project and social value slices be served within budget without breaking the rule that dashboards never read raw calculations?

Findings:
- `DashboardAggregate` writes the same calculations into several single-dimension rows plus a category-by-facility cross row (`aggregate-filters.ts`). Adding supplier and project the same way would multiply rows and repeat the double-counting trap that file warns about.
- `ActivityRecord` carries `supplierName` (free text, normalised elsewhere by `supplierKey()`), `siteId`, `contractId` and `facilityId`. A project is reached through its site or contract. Social value is a different domain (`SvActivity`, `SvCommitment`) and is a filter on those records, not a slice of emissions.
- A timing benchmark on a throwaway local Postgres 16 (100k records, two calculation runs, uniform synthetic data, best of three, includes about 30 ms of client start-up; timing only, no product data):

| Query | Time |
|---|---|
| Raw join, top suppliers, latest run found per record by subquery | 368 ms |
| Raw join, top suppliers, run pinned | 85 ms |
| Base-grain fact table, top suppliers | 59 ms |
| Fact table, category with 5 sites | 31 ms |
| Fact table, monthly trend for one supplier and contract | 31 ms |
| Fact table, category by facility by supplier (cross-filter worst case) | 139 ms |

Reading the numbers honestly: at 100k records both approaches are inside the budget when the run is pinned; only the latest-run-per-record lookup is slow. The uniform data gave the fact table almost no row reduction (99,649 rows from 100,000), so real data will favour it more, but that is not measured here. The decisive reasons are correctness and consistency, not speed.

Decision: add one **base-grain slice table**, written inside the same transaction that rebuilds `DashboardAggregate` for a run, one row per distinct combination of scope, category, facility, site, contract, normalised supplier key, month and Scope 2 method, holding summed kg CO2e and record count. Reads roll it up with `GROUP BY`; because there is one row per combination, there is no double-counting and no dedupe fragment. Published snapshots keep a frozen copy, as `DashboardAggregate` does. The migration is additive, with RLS deny-all.
Still to verify in phase 1, on real organisation data: row-count reduction, rebuild time added to a calculation run, and agreement with `DashboardAggregate` totals (a reconciliation test, like `report-dashboard-reconciliation.test.ts`).
Social value filtering keeps its own source and is applied as a record-set filter, with the social value totals shown beside, never added to, emissions.

**Phase 1: slice table, saved views and the first pages.** *Step 1 (slice table, writer, snapshot copy, reconciliation test) is built. Step 2a (saved view model and API, personal and shared, with tenancy and role tests) is built; Step 2b (the Views menu on the dashboard) is built; the other pages follow one at a time as their filters move to the URL (done: records, suppliers, submissions, calculations). Step 3: the dashboard reads the slice table for supplier, month range and scope filters; project and Social Value filters follow.*
Slice table and its reconciliation test first, then the shared filter bar and saved views (personal and shared, with role-based visibility) on the main dashboard and on the records, suppliers, field submissions and calculations pages.
Server-side table with faceted filters, column control, sticky headers, virtualised rows, saved personal and shared views, CSV and XLSX export of the current view, the shared filter bar (date, project, supplier, scope, social value) with URL-synced state.
Exit: dashboard and table interactions under 200 ms perceived; view create, share and delete audit-logged; tenancy and role tests added; axe clean; no regression in existing tests.

**Phase 2: chart kit and flagship charts.**
Shared primitives, then the pathway chart (actual, target, 1.5C, initiatives) and the scope-to-category-to-site Sankey, then a waterfall of period change.
Exit: every chart has a table view, keyboard focus, light and dark palette validated; chart totals equal report totals in tests.

**Phase 3: customisable dashboard.**
Widget registry, layout editor on the main dashboard only, role-specific defaults, add and remove widgets, per-user layout with organisation default.
Exit: keyboard-operable editing; layout survives reload; a role without permission never receives a widget's data.

**Phase 4: cross-filtering and drill-down.**
Click a chart element to filter the others; drill to records through the existing drill-down route; command palette; detail side panels.
Exit: cross-filter results match table totals for the same filters.

**Phase 5: map and time scrubber.**
Site map with clustering; scrub across published snapshots.
Exit: tile provider terms confirmed in `docs/THIRD_PARTY_SOURCES.md`; map degrades to a list without a tile source.

**Phase 6: assisted reporting.**
Report narrative editor (Tiptap), "explain this change" on a delta, grounded insights.
Exit: AI off by default, grounding check applied, generated text labelled, report output unchanged when AI is off.

## 8. Quality gates (every phase)

- `pnpm lint && pnpm knip && pnpm typecheck && pnpm test && pnpm build` green; the end-to-end suite extended for the new flow.
- New dependencies: licence recorded in `docs/THIRD_PARTY_SOURCES.md`, size measured, loaded dynamically, knip clean.
- Performance: dashboard under 3 s at 100k records; first-load JS for a page reported in the pull request.
- Security: tenancy test per new route; no raw error text to clients; saved-view ids validated.
- Accessibility: keyboard path and screen-reader label for each interaction; reduced motion respected.
- Rollback: each phase can be turned off by removing its entry points; no migration in a phase may drop or rename anything (additive only, per the migration rules).

## 9. Risks

| Risk | Mitigation |
|---|---|
| Slice table disagrees with `DashboardAggregate` or slows calculation runs | Reconciliation test and rebuild-time measurement are phase 1 exit criteria. |
| Custom chart kit grows into its own project | Build primitives first, two flagship charts, then stop and review. |
| Drag and resize fail accessibility | Keyboard alternative is an exit criterion, not a follow-up. |
| Bundle growth hurts marketing and sign-in pages | Dynamic imports only inside `(app)`; size reported per page. |
| Saved views leak across tenants or roles | Server-side enforcement, tenancy tests, audit log. |
| Scope creep toward a BI tool | Fixed metric and grouping list; additions need a review. |

## 10. Open questions

1. Name the first two roles to design the default dashboards for (assumption stated at the top).
2. Who may publish a shared view: any editor, or only admins and sustainability leads? Proposed: editors and above create shared views, any member can save a personal copy, admins can remove a shared view.
3. Should a shared view follow later edits automatically, or should people be notified and choose? Proposed: shared views are edited in place, with an audit log entry and a "last updated by" label.

## 11. Reference material

- sadmann7/tablecn (MIT): server-side table patterns.
- react-grid-layout (MIT), visx (MIT), d3-sankey (BSD-3), cmdk (MIT).
- Kiranism/next-shadcn-dashboard-starter (MIT): shell patterns only; do not fork.
- Competitor marketing and product patterns reviewed on 4 October 2026: Watershed, Sweep, Normative, Persefoni, Greenly, Linear. Findings are structural (proof early, assistant section, audit trail); no visuals were captured.
