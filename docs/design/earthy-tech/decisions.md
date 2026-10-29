# Design decisions (owner, supersede earlier drafts in this folder)

Status: design approved (desktop and mobile artefacts). Implementation plan in `implementation_plan.md`. No production UI code is authorised until the owner says to build.

1. **Two reds stay split.** Terracotta (`--hi`) marks interactive and neutral information, such as Scope 3 bars. Brick (`--neg`) is reserved for alerts such as the behind-glidepath variance, always with an icon and a word.
2. **Fonts, SIL OFL only.** Serif for narrative headers: Newsreader (Instrument Serif is the alternative). Mono for data: JetBrains Mono (Fira Code is the alternative). UI sans: Geist (Inter is the alternative). Record each licence in `docs/THIRD_PARTY_SOURCES.md` before any font is bundled.
3. **Social baseline phases:** Data Mapping, Initial Audit, Baseline Established, Active Monitoring. Still derived from which inputs exist, never a grade.
4. **UK regime toggle.** The Audit Hub UK tab carries a quiet segmented control, "TCFD group" or "FCA-regulated", stored as a one-time organisation setting, never a modal. Each choice has its own datapoint set, so the ready count is scored against the matching denominator. The counts in the mockup (8 of 11, 5 of 9) are demo figures: the real sets must come from the regulator texts before build, and the page says "ready", never "compliant".

## Build notes (implementation started)

5. **Serif is allowed on this surface only.** The taste skill bans serif defaults; the owner chose Newsreader for the Executive Summary, scoped under `.earthy` (`.e-serif`). Do not "fix" it back, and do not use it elsewhere.
6. **Summary renders inside the existing org shell for now.** The rail and mobile tab bar (plan phase 6) are not built yet. The Summary is behind `earthyEnabled()` (`EARTHY_DASHBOARD_ORGS`, or `?earthy=1` for an admin), default off.
7. **Audit tile shows no number** until real TCFD and FCA datapoint sets exist (plan phase 5).
8. **Glidepath rule awaiting owner sign-off:** linear line from the baseline total to the target level at the target date; a complete period is compared in full, a running period pro rata; on track means within 2% of the line.
