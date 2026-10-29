# Earthy Tech Executive Summary: implementation plan

Status: approved design, plan for review. No production UI code exists yet, and none is written until the owner says to build.

The approved artefact is the desktop and mobile showcase (one page, two frames). `decisions.md` records the four owner decisions and supersedes older wording in `product_narrative.md`, `ui_structure.md` and `tokens.md` (phase names and the serif choice). Where this plan and those files disagree, this plan and `decisions.md` win.

## Scope

In scope: the new Executive Summary at `/orgs/{orgId}/dashboard`, its shared components, the tokens and fonts it needs, the UK regime setting that the Audit tile depends on, and the responsive behaviour (desktop rail, mobile tab bar).

Out of scope for this plan: the marketing site (`app/(marketing)`, owner decision: it stays exactly as it is, so no token, font or copy change reaches it; the `.earthy` scope in phase 1 is what keeps the new palette out of it), the Carbon, Social and Audit module pages the tiles link to (they keep their current pages until each gets its own pass), the CSRD module (stays a dormant, greyed tab), and the Flutter field app in `mobile/`. "Mobile" here means the responsive web view of the Summary. The field app is a separate surface with its own capture flow and is not restyled by this work. If the owner wants the field app brought into the same look, that is a second plan.

## Principles that constrain every phase

1. Every figure comes from `DashboardAggregate`, never raw `EmissionCalculation` rows.
2. Every sentence is built from a template with a data guard. If an input is missing the sentence is not rendered and the tile shows its empty state, with a link to where the data is added.
3. Demo data carries a persistent `Demo data` label, as in the artefact.
4. No "compliant" or "assured" wording. The Audit tile says ready, partly ready or missing.
5. Dates, numbers, money and tonnes go through `formatters()` and `useOrgMoney()`. No hard-coded country, currency or regulator.
6. Filters live in the URL, and the page joins `SURFACES` in `lib/saved-views/index.ts`.
7. Only real claims. The 8 of 11 and 5 of 9 readiness counts in the artefact are placeholders and must not ship until the real datapoint sets exist (phase 5).

## Phases

Each phase is one mergeable change that leaves `main` working. Order matters: later phases depend on earlier ones.

### Phase 0: flag and scaffolding

Add a feature flag, `earthyDashboard`, resolved per organisation (default off). The dashboard route renders the current page when the flag is off and the new page when it is on, so the old dashboard stays the fallback until sign-off. Create `components/earthy/` for the new shared components so nothing in the existing design system is touched. Knip fails on unused files, so each component lands with its first use.

### Phase 1: tokens and fonts

Tokens. Add the artefact's palette as Tailwind 4 `@theme` variables in the app stylesheet, scoped under an `.earthy` wrapper class so the rest of the app does not shift: ground, surface, sunk, line, ink, the moss, terracotta and brick scales, and the dark theme block. Keep the two reds split exactly as decided: terracotta (`--hi`) is interactive and neutral, brick (`--neg`) is alert and always comes with an icon and a word. Radii stay in the 12 to 16px system. Motion tokens: the ease `cubic-bezier(.22,1,.36,1)`, transform and opacity only, hover lift behind `@media (hover:hover)`, press scale, and the reduced-motion rule last.

Fonts. Newsreader (serif, greeting and primary titles only), Geist (UI), JetBrains Mono (figures and metadata), all SIL OFL, loaded with `next/font` so they are self-hosted and cause no layout shift. Record each licence in `docs/THIRD_PARTY_SOURCES.md` before merging. Limit the Newsreader axes to the two weights and the optical size range the artefact uses, to keep the payload small.

Existing rule conflict to resolve. The taste skill bans serif defaults and Instrument Serif. The owner has explicitly chosen Newsreader for this surface, so the serif is allowed here and only here. Note that in `decisions.md` so the skill is not "fixed" back later.

Checks: no visual regression on pages outside the `.earthy` wrapper (Playwright screenshots of two unrelated pages), Lighthouse performance on the dashboard not worse than today.

### Phase 2: shared components

Map from `ui_structure.md` to code, each a leaf client component only where it needs interaction:

- `NarrativeGreeting`: serif sentence with inline mono figures that link. Types in once, skipped under reduced motion.
- `SummaryBento`: the grid. Five tiles, exactly as many cells as tiles, no empty cells.
- `TotalTile`, `TargetTile` (glidepath line, actual against target), `HotspotTile` (small Sankey preview, loaded with `next/dynamic` and `ssr: false` like the other charts), `SocialPhasesTile`, `AuditRingTile`, `NeedsYouList`.
- `RegimeToggle`: the quiet two-option segmented control, "TCFD group | FCA-regulated". A radiogroup with arrow-key support, not a modal.
- `InsightTooltip` and `Toast`: the glass tooltip and toast from the interaction layer. On touch the tooltip is a bottom sheet above the tab bar.
- `MobileTabBar` and the desktop rail (`AppRail`): the same five destinations, Summary, Carbon, Social, Audit, Records, with the Records badge fed from the review queue count.
- Reuse, do not rebuild: `EmptyState` for every empty state, the shared `Table` for any table, `components/forms/form-kit.tsx` for forms, `SectionNav` where a stepper is needed.

The glass effect (blur) is limited to the tab bar, the tooltip and the toast, never inside content.

### Phase 3: the data loader and sentence templates

One server loader, `loadExecutiveSummary(orgId, filters)` in `lib/dashboard/`, returning a single typed object. It reads `DashboardAggregate` for the totals, the year-on-year change, the glidepath and the hotspot, the review queue for "Needs you", and the factor register for expiring supplier factors. Because Prisma has one connection per function instance, the loader uses a small number of grouped statements (the pattern in `lib/dashboard/page-data.ts`) rather than many parallel queries.

Sentences live in `lib/dashboard/narrative.ts` as pure functions of the loader output, each returning a string or `null`. The set is closed: greeting, needs-you line, glidepath line, hotspot line, social phase line, audit line. Each has a guard for a missing input, and a quiet-day and first-run variant as written in `product_narrative.md`. A bad month is stated as flatly as a good one, followed by the one action that would help.

Two known gaps from the artefact to close here, not paper over:

- The greeting's "38 tonnes behind" needs a defined, tested rule (cumulative actual to date against the glidepath to date) and a unit shown. If the glidepath is not set, the sentence is not rendered and the tile links to Targets.
- The bar chart axis in the artefact starts at zero and the bars look flat. In production the axis is chosen from the data range with the baseline marked, and the choice is stated in the chart's accessible description.

### Phase 4: the Social tile

Four named phases, never a letter grade: Data Mapping, Initial Audit, Baseline Established, Active Monitoring. The phase is derived from which inputs exist (HR and supply chain sources connected, first data processed, baseline recorded, live variance tracking), by a pure function with a table-driven test. The method is one click away from the tile. A supplier line such as "Labour risk is flagged on N of M suppliers" renders only when supplier risk data exists.

### Phase 5: the UK regime setting and real readiness counts

This is the one phase that touches the schema and must follow the migration rules.

Setting. Add an organisation-level `ukDisclosureRegime` (`tcfd_group` or `fca_regulated`), nullable, set once from the segmented control on the Audit tile or in Settings. Additive migration only, generated with `prisma migrate diff`, with the CI drift baseline kept at zero. If the setting adds a table rather than a column, the migration enables row level security with a deny-all policy and is guarded for plain Postgres 16 as the other migrations are. The change is written to the audit log through `writeAuditLog()`, and the write is restricted to admin. Until the setting exists the tile shows the toggle in its unset state and no readiness number, which is better than a count scored against the wrong denominator.

Datapoint sets. Replace the placeholder counts with real sets taken from the regulator texts: the TCFD recommended disclosures for the group view and the FCA's sustainability disclosure requirements for the FCA-regulated view. Each set records its source, the date it was last checked and its licence, and joins the regulatory calendar's recheck routine (`LAST_CHECKED`). Readiness is computed against that regime's own denominator and each missing datapoint links to the page where it is added (the fix-path rule, which `lib/completeness/__tests__/fix-paths.test.ts` enforces). Wording stays "ready", "partly ready", "missing". CSRD remains a dormant, greyed tab with no score.

### Phase 6: responsive behaviour

Desktop: left rail, bento grid with "Needs you" in its natural place. Below 760px: the rail hides, a fixed glass tab bar appears (44px minimum targets), the bento becomes a single column ordered Needs you, Total, Target, Hotspot, Social, Audit, and the page gets bottom padding for the tab bar plus the safe area inset. The header becomes sticky and blurred. No horizontal scroll at 320px. Hover effects exist only under `@media (hover:hover)`.

### Phase 7: interaction layer and accessibility

Port the interaction layer as a small client module: fixed tooltip, toast, SVG scrubber on the glidepath, spotlight highlight, press guard, keyboard support. Rules: transform and opacity only, `will-change` only on elements that animate continuously, no scroll listeners (use Motion `useScroll` or CSS scroll-driven animation), everything collapses to static under `prefers-reduced-motion`, and no information is carried by animation or colour alone. Every chart has a text equivalent, every icon-only control a label, focus rings are visible, and brick alerts always pair colour with an icon and a word. Contrast is checked from the token hex values, with the numbers recorded in the PR. Nothing about the accessibility checks appears on the dashboard itself.

### Phase 8: tests, rollout and removal of the flag

Tests:

- Golden test for the loader against fixed fixtures, in the style of `tests/golden/dashboard-page-data.test.ts`.
- Reconciliation: the Summary's total equals the dashboard and report total for the same snapshot (`report-dashboard-reconciliation.test.ts` pattern).
- Narrative functions: every template with and without each input, including first run and quiet day.
- Social phase and readiness functions, table driven.
- Security: the loader and the regime setting are org scoped, `field_worker` cannot read the Summary, and `tests/security/cross-tenant-writes.test.ts` gains the new write.
- Playwright at 1440 and 390 wide: no horizontal overflow, no console errors, touch targets at least 44px, toggle updates ring, count and text, tab bar navigates.
- Standard gates before every merge: `pnpm lint && pnpm knip && pnpm typecheck && pnpm test && pnpm build`.

Rollout: flag on for the owner's organisation, then internal organisations, then everyone, with the `page-timing` log (`stageTimer()`) watched for the 1.5 s threshold. The old dashboard route is removed in a later release, once nothing links to it, and the flag is deleted with it.

## Risks and open items

- Placeholder readiness counts must not ship. Phase 5 blocks the Audit tile's number, not the rest of the page.
- Newsreader's optical size axis can add weight. Subset it and measure; fall back to the fixed-size cut if LCP regresses on mobile.
- The artefact uses the owner's demo organisation. Production must show the `Demo data` label on any demo organisation and must never show invented numbers for a real one.
- The glidepath rule behind "38 tonnes behind" needs the owner's sign-off on its definition before it is coded.
- The Carbon, Social and Audit module pages are not restyled here, so the tab bar will move between the new Summary and the old pages. Decide whether the old pages get the `.earthy` wrapper as a stopgap.
- Field app: not covered. Confirm whether a Flutter restyle is wanted.

## Definition of done for the Summary

Flag on, all phase 8 tests green, no placeholder figures, licences logged, Lighthouse not worse than the current dashboard, the Summary total reconciles with the report total, and the owner has looked at it on a real phone.
