# Design decisions (owner, supersede earlier drafts in this folder)

Status: design approved (desktop and mobile artefacts). Implementation plan in `implementation_plan.md`. No production UI code is authorised until the owner says to build.

1. **Two reds stay split.** Terracotta (`--hi`) marks interactive and neutral information, such as Scope 3 bars. Brick (`--neg`) is reserved for alerts such as the behind-glidepath variance, always with an icon and a word.
2. **Fonts, SIL OFL only.** Serif for narrative headers: Newsreader (Instrument Serif is the alternative). Mono for data: JetBrains Mono (Fira Code is the alternative). UI sans: Geist (Inter is the alternative). Record each licence in `docs/THIRD_PARTY_SOURCES.md` before any font is bundled.
3. **Social baseline phases:** Data Mapping, Initial Audit, Baseline Established, Active Monitoring. Still derived from which inputs exist, never a grade.
4. **UK regime toggle.** The Audit Hub UK tab carries a quiet segmented control, "TCFD group" or "FCA-regulated", stored as a one-time organisation setting, never a modal. Each choice has its own datapoint set, so the ready count is scored against the matching denominator. The counts in the mockup (8 of 11, 5 of 9) are demo figures: the real sets must come from the regulator texts before build, and the page says "ready", never "compliant".

## Build notes (implementation started)

5. **Serif is allowed on this surface only.** The taste skill bans serif defaults; the owner chose Newsreader for the Executive Summary, scoped under `.earthy` (`.e-serif`). Do not "fix" it back, and do not use it elsewhere.
6. **Summary renders inside the existing org shell for now.** The rail and mobile tab bar (plan phase 6) are not built yet. The Summary is the only dashboard for every organisation (owner decision: global theme for current and future users). The `earthyEnabled()` flag and `EARTHY_DASHBOARD_ORGS` rollback lever were removed on 30 Oct 2026 with the old page.
7. **Audit tile shows no number** until real TCFD and FCA datapoint sets exist (plan phase 5).
8. **Glidepath rule (owner approved, wording checked 29 Oct 2026):** straight line from the baseline period total to the target level at the target date, using the organisation's own base year and target (IFRS S2 and ESRS E1 both ask for a base period, base value and target value). A complete period is the official status; a running period is compared pro rata and labelled "Year to date", "indicative", never raised as an alert. The 2% on-track band is our display tolerance, not a framework figure. Wording says "straight path", never "SBTi-aligned" or "compliant": SBTi's absolute contraction rate (4.2% a year floor, method revised September 2025) and GHG Protocol Chapter 11 (under revision) are not applied here. Primary texts could not be fetched (hosts blocked); re-verify against them when reachable.
9. **Breakpoint is 768px** (Tailwind `md`), not 760px: one breakpoint for the rail, the tab bar and the header.
10. **No tooltip, toast or scrubber yet.** Phase 7 builds none, because the Summary has no chart that needs them and knip fails on unused files. Add them with the first chart that does.
11. **Phase 8 done:** regime setting security test, Playwright spec at 1440 and 390, docs and rollout notes. The flag and the old dashboard are removed in a later release after the owner signs off the glidepath rule. Not measured: a Lighthouse comparison (the tool was blocked in the build environment), so the effect of `preload: false` on JetBrains Mono on LCP is unverified.
