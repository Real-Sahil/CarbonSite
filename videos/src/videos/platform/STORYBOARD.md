# Platform film storyboard

Composition `Platform`, 1920x1080, 60 fps, 90 s (45 bars at 120 BPM, 4/4; bar n starts at (n-1) x 2 s).
Beat times come from `cues.ts` (`b(bar, beat, fraction)`). Bars 1-24 reuse the launch acts on launch timing (`launch/cues.ts`).

## Bars 1-24: launch acts

| Time (s) | Bars | Act | On-screen copy | UI shown | Source |
|---|---|---|---|---|---|
| 0.0-3.8 | 1-2 | Open | MetricOra wordmark and mark (the M draws at 0.5 s) | Brand lockup, no product UI | `launch/acts/Brand.tsx` `Open`, `launch/cues.ts` `CUE.open` |
| 4.0-5.9 | 3 | Words, card 1 | "Carbon figures that hold up" | Type only | `launch/acts/Brand.tsx` `CARDS[0]` |
| 6.0-7.9 | 4 | Words, card 2 | "when someone checks them." | Type only | `CARDS[1]` |
| 8.0-16.4 | 5-8 | FieldApp | Tiles: Waste Ticket, Delivery Note, Fuel Receipt, Social Value, Hazard / Near Miss, Site Inspection. Fields: Volume (litres) 520, Supplier Certas Energy. "Fit the ticket in the frame", "Reading on this phone", "Read 4 fields", "Submit", "Submitted for review" | Phone capture of a fuel receipt (ML Kit OCR step) | `launch/acts/FieldApp.tsx`, `launch/cues.ts` `CUE.phone` |
| 16.0-19.8 | 9-10 | Review | "Fuel receipt", "Submitted by Dan Mitchell", "Reviewed by Sam Hartley", field table (Document type, Reporting period FY2025, Category Scope 1: Mobile Combustion, Volume unit litres, Supplier name Certas Energy) | Web review queue, Submissions sidebar, Approve | `launch/acts/Review.tsx`, `CUE.review` |
| 20.0-21.9 | 11 | Words, card 3 | "Open any figure." | Type only | `CARDS[2]` |
| 22.0-29.8 | 12-15 | Trace | "TOTAL FOOTPRINT 4,710.05 tCO2e", "Scopes 1-3 FY2025", "Records behind this figure", "Fuel receipt, Certas Energy", "520 litres", "0.03558 kg CO2e/litre", "18.50 kg CO2e", Verified, DEFRA 2025.2, ghg-protocol-v2026-02, "Biogenic CO2 reported separately, outside the scopes" | Headline to record drill-down, factor chips | `launch/acts/Trace.tsx`, `CUE.trace` |
| 30.0-31.9 | 16 | Words, card 4 | "The three documents most contractors need." | Type only | `CARDS[3]` |
| 32.0-39.8 | 17-20 | Docs | "Carbon Reduction Plan" (PPN 006, FY2025), "SECR report", "GHG Protocol report" (Scopes 1, 2 and 3, FY2025), "Scope 2 (location-based) 154.6 tCO2e" | Three generated documents land, CRP comes forward | `launch/acts/Docs.tsx`, `CUE.docs` |
| 40.0-43.8 | 21-22 | Pack | "ASSURANCE PACK", "assurance-pack-FY2025.zip" | Assurance pack download | `launch/acts/Pack.tsx`, `CUE.pack` |
| 44.0-47.9 | 23-24 | Words, card 5 | "From site paperwork" / "to a published figure." | Type only | `CARDS[4]` |

## Bars 25-38: product screens (one browser window, 3.5 s each)

The window stays on stage. Each screen swaps in with a short blur; the address bar shows its route. Window: `ui/App.tsx` `BrowserWindow`. Timing: `cues.ts` `slot(i)`, `SCREEN_SECONDS` = 3.5 s (seven beats, so each cut lands on a beat), `SCREENS_IN` = 48 s, `MONTAGE_IN` = 76 s, `SCREENS_OUT` = 80 s.

| Time (s) | Route (address bar) | On-screen copy | UI shown | Source |
|---|---|---|---|---|
| 48.0-51.5 | /orgs/northgate/submissions | Demo tenant screen | Submissions review queue (screenshot) | `public/screens/platform/submissions.jpg` (from `public/marketing/screens`), `platform/screens.tsx` `SCREENS[0]` |
| 51.5-55.0 | /orgs/northgate/calculations/run-fy2025 | "Calculation run", "FY2025 · DEFRA 2025.2 library", "TOTAL FOOTPRINT 4,710.05 tCO2e", Published, DEFRA 2025.2, AR6, ghg-protocol-v2026-02, "Fuel receipt, Certas Energy" Verified, "520 litres x 0.03558 kg CO2e/litre = 18.50 kg CO2e", "Selection reason: same category, unit and period", "Biogenic CO2 is reported beside the inventory, never inside it." | Calculation run, figure with its factor and selection reason | `platform/screens.tsx` `Calculation`, figures from `launch/acts/Trace.tsx` |
| 55.0-58.5 | /orgs/northgate/settings/energy-instruments | "Electricity contracts", "Renewable certificates and PPAs" (Claimed first), "Green tariffs", "Supplier rate", "Residual mix" (In order), "Any kWh not covered falls back to the library factor, with a warning." | Market-based Scope 2 order | `platform/screens.tsx` `Instruments` (redrawn) |
| 58.5-62.0 | /orgs/northgate/compliance/deadlines | "Regulatory calendar", regions UK, EU-27, Germany, UAE, US, Australia, Canada, Show all; "Streamlined Energy and Carbon Reporting (SECR)", "Carbon Reduction Plan, PPN 006", "Corporate Sustainability Reporting Directive"; "Official source" | Calendar with per-entry source (redrawn) | `platform/screens.tsx` `Deadlines`, `compliance/regions` rules in app (`lib/compliance/regions.ts`) |
| 62.0-65.5 | /orgs/northgate/compliance/audit-trail | "Audit trail", "Append-only. Each entry is hashed into one chain per organisation.", "Chain intact", events: Calculation run published, Field submission approved, Import committed, Role changed | Audit trail with chain status (redrawn) | `platform/screens.tsx` `AuditTrail`; behaviour in `lib/audit/chain.ts` |
| 65.5-69.0 | /orgs/northgate/reports | "Reports", "Every figure comes from the published snapshot for FY2025."; GHG Protocol report, PPN 006 Carbon Reduction Plan, SECR report, Bid carbon pack | Report picker (redrawn) | `platform/screens.tsx` `Reports`; `reports` picker rules in `docs/dev/features/reporting-and-compliance.md` |
| 69.0-72.5 | /orgs/northgate/transition-plan | Transition plan page (demo tenant) | Transition plan (screenshot) | `public/screens/platform/transition-plan.jpg` (from `public/marketing/screens`), `SCREENS[6]` |
| 72.5-76.0 | /orgs/northgate/settings/carbon-price | "Internal carbon price", "Versioned prices. The one in force values the dashboard totals and each initiative.", Shadow price (In force), Internal fee, Implicit price (Not in force) | Carbon price versions (redrawn) | `platform/screens.tsx` `CarbonPrice` |

## Bars 39-40: feature montage (one 4 s beat, six tiles)

The window's address bar shows `/orgs/northgate`; each tile shows its own route. Every tile is labelled "Demo data" and shows dashes where a figure would be (no value is invented). Tiles are redrawn from `ui/tokens.ts` with the app's labels; no marketing capture shows these features (`public/marketing/screens/report-picker.jpg` shows only a cut-off Bid carbon pack row). Source: `platform/screens.tsx` `MONTAGE`, `Montage`.

| Time (s) | Tile | Route (tile label) | Claim it supports | Source |
|---|---|---|---|---|
| 76.0-80.0 | Duty of care register | /orgs/northgate/waste/register | The register lists transfers by site, waste and carrier, with keep-until dates, and flags transfers with gaps. | `app/(app)/orgs/[orgId]/waste/register/page.tsx`, `lib/waste/` |
| 76.0-80.0 | Site Waste Management Plan | /orgs/northgate/waste/plan | One plan per project: forecast set beside recorded waste by type and planned route, with diverted so far and target. | `app/(app)/orgs/[orgId]/waste/plan/page.tsx` |
| 76.0-80.0 | Plant telematics | /orgs/northgate/plant | Idling, fuel burnt, carbon from that fuel and HVO share per machine. Readings are monitoring only, reconciled to approved fuel records. | `app/(app)/orgs/[orgId]/plant/page.tsx`, `lib/plant/telematics.ts` |
| 76.0-80.0 | Carbon budget burn-down | /orgs/northgate/contracts/road-scheme/projects/junction-4/carbon-budget | Measured carbon by month against a straight spend line, a forecast at completion, and the On track, At risk and Over statuses. The line shape is illustrative only. | `app/(app)/orgs/[orgId]/contracts/[contractId]/projects/[projectId]/carbon-budget/page.tsx`, `lib/project-carbon/burndown.ts` |
| 76.0-80.0 | PAS 2080 carbon management | /orgs/northgate/contracts/road-scheme/projects/junction-4/pas2080 | Baseline, target, forecast and measured to date, with the reduction hierarchy: build nothing, build less, build clever, build efficiently. | `app/(app)/orgs/[orgId]/contracts/[contractId]/projects/[projectId]/pas2080/page.tsx`, `lib/pas2080/index.ts` |
| 76.0-80.0 | Bid carbon pack | /orgs/northgate/reports | The carbon section of a tender in one PDF: PPN 006 Carbon Reduction Plan, emissions trend across published snapshots, up to five featured contracts, assurance status. A section with no data is left out. | `lib/bids/carbon-pack.ts`, picker in `app/(app)/orgs/[orgId]/reports/page.tsx` |

## Bars 41-45: ending

| Time (s) | Bars | Copy | UI shown | Source |
|---|---|---|---|---|
| 80.0-82.0 | 41 | MetricOra lockup (mark draws at 80.5 s, wordmark at 81.5 s) | Brand lockup | `launch/acts/Brand.tsx` `End`, `platform/cues.ts` `END` |
| 82.0-84.5 | 42 | Lockup rises 90 px; "Start your Carbon Reduction Plan" button (82.5 s) | CTA button | same |
| 84.5-85.0 | 42-43 | "metricora.co.uk" (84.5 s) | Address | same |
| 84.0-85.5 | 43 | "Carbon Reduction Plan", "SECR", "GHG Protocol report" | Document list | same |
| 85.0-86.0 | 43-44 | "Android field app on Google Play" (85 s); cursor moves to the CTA, hover state at 86 s | Cursor, CTA hover | same, `appLabel` prop |
| 88.0-90.0 | 45 | Fade to stage colour from 88 s | None | same, `END.fade` |

## Notes

- Redrawn screens and tiles use only figures already in the film (4,710.05 tCO2e, 520 litres, 18.50 kg CO2e, DEFRA 2025.2, ghg-protocol-v2026-02, Certas Energy, Northgate Civils Ltd). Waste, plant, budget and PAS 2080 tiles carry no numbers.
- No claims of compliance or lawfulness; the regulatory calendar shows official sources and the last-checked date. The bid pack tile says only what the pack includes.
- Screens 1 and 7 are demo-tenant captures copied to `videos/public/screens/platform/`.
- Review stills (`out/review/platform-v2`) need a local `public/audio/launch/sfx-peaks.json`, which `compose.py` writes and which is not in the repo; `Launch.tsx` imports it, so the Platform bundle fails without it.
- Audio is not in this composition; the audio step mounts score and SFX on this grid.
