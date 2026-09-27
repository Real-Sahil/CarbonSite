# MetricOra video kit

The look, rules, assets and code for every MetricOra film. Each film prompt points here and only adds its story.
Sources: `app/(marketing)` (landing), `app/globals.css` (`--color-mk-*`), `public/marketing/screens/*.jpg` (real product captures from the demo tenant), `CLAUDE.md` (claims and marketing rules), product owner answers of 27 September 2026. When this file and the repo's rules disagree, the repo wins.

## The brief (from the interview)
- Plays: launch video with sound. Format: 16:9, 1920x1080, 60 fps. Length: 56 s (28 bars at 120 BPM).
- Music: original score composed in code for this film (`scripts/compose.py`), owned outright, no licence terms. Royalty-free music sites were unreachable from the build machine, so nothing third party is used.
- Must show: field app capture and review, records to calculation, trace a figure, Carbon Reduction Plan and reports, the assurance pack.
- Ingredients: logo reveal at the open and close · big punchlines word by word · magic moves · cursor interactions, a phone frame for the field app, proof moments from demo data.
- Ending: logo lockup, "Start your Carbon Reduction Plan", metricora.co.uk.

## Hard rules
- No em or en dashes in any copy (CLAUDE.md, taste-skill hard bans).
- Only real product and real claims: figures come from the demo tenant (Northgate Civils Ltd, fictional) and are labelled "demo data" on screen (CLAUDE.md, Marketing site).
- No invented testimonials, customer metrics, competitor comparisons or statistics (CLAUDE.md).
- Field app: Android is live; the App Store is not claimed and no Apple device or App Store badge appears (CLAUDE.md). The phone is a neutral Android-style frame.
- Type: Geist only, Geist Mono for formulas and file names (`app/layout.tsx`, marketing kit).
- Corners: cards 12 px, buttons 10 px, badges pill (`--radius-*`, screenshots).
- Surfaces: the stage is `mk-ink`; product UI sits in a browser window on it, with the app's own white cards and gray-50 page.

## Frame (1920x1080, 60 fps, dark stage, light product UI)
- Framing: product windows float on the graphite stage like the marketing site's dark sections.
- Words: Geist 600, 128 to 150 px, `mk-on-dark`, key words `mk-accent-lit`.
- Scenes: UI text only (plus the "Demo data" tag).

## Color
| Token | Value | Use |
|---|---|---|
| stage | `#0B100E` | mk-ink, the film's background |
| stage-2 | `#131A17` | mk-ink-2, window shadows' ground |
| on-dark | `#F1F4F2` | punchlines |
| on-dark-2 | `#B4BFBA` | secondary words on the stage |
| accent-lit | `#FB8A4B` | accent words on dark |
| accent | `#C2410C` | app primary (buttons, hero card, active nav text), sampled from screenshots |
| page | `#F9FAFB` | app page |
| card | `#FFFFFF` | app cards |
| border | `#E5E7EB` | app card borders |
| text | `#111827` | app text |
| muted | `#6B7280` | app secondary text |
| active-bg | `#FFF7ED` / `#FED7AA` | active nav fill and border |
| approved | `#DCFCE7` / `#166534` | approved chip |
| amber | `#FEF3C7` / `#92400E` | partially verified, pending |
| scope 1 / 2 / 3 | `#EA580C` / `#2563EB` / `#16A34A` | dashboard scope figures |
| logo gradient | `#F97316` to `#FBBF24` | the mark (`public/logo.svg`) |
| field app seed | `#1B5E20` | Material 3 seed of the Flutter app (`mobile/lib/core/theme/app_theme.dart`) |

## Type
- Geist Sans and Geist Mono from `node_modules/geist` copied to `public/fonts`.
- Punchlines 128 to 150 px; UI 24 px and up at 1080p.

## Signature elements
| Element | Look | Source |
|---|---|---|
| Buttons | orange fill, white text, 10 px radius; outline variant white with border | records screenshot |
| Status chips | pill, tinted fill (approved green, in review white outline, partially verified amber) | records, submission review |
| Evidence tier | "Verified" / "Partially verified" / "Estimated" pill | `EvidenceTierBadge` |
| Hero card | solid orange card with total footprint | dashboard |

## Logo
- Mark: 56 px rounded square (`rx` 12) with the orange to amber gradient and a white "M" stroke (`M11.5 44.5 L20 14 L28 30 L36 14 L44.5 44.5`, width 5, round caps). Wordmark "MetricOra" Geist 700.
- Animation: the square scales in on a spring, the M stroke draws itself, the wordmark lands letter group by letter group.

## Cursors
- User: the OS arrow (kit). A click is a short squash, then the target reacts.

## Components (all redrawn twins: the app needs auth and a database, so films redraw its screens from the screenshots with the same tokens)
| Need | Source | In films |
|---|---|---|
| Browser window | marketing `ProductShot` | redraw |
| Sidebar, dashboard hero card, scope tiles | `app/(app)/orgs/[orgId]/dashboard` | twin |
| Submission review | `submissions/[id]` | twin |
| Records table row | `records` | twin |
| Calculation detail (formula, factor, reason) | lineage page, homepage hero figure | twin |
| CRP emissions step | `crp` wizard | twin |
| Field app capture | `mobile/lib/features/capture` | twin in a phone frame |

## Motion
- Easing from the marketing site and kit: `cubic-bezier(0.22, 1, 0.36, 1)` for landings, springs (stiffness 150, damping 20) for magic moves.
- Transitions: magic moves (the receipt card leaves the phone into the review page; the approved submission becomes the record row; the record opens into its calculation; the headline total travels into the Carbon Reduction Plan).

## Claims
- Films may show: field capture with on-device OCR, review and approval, calculation with factor, formula and selection reason, evidence tier, trace a figure, Carbon Reduction Plan, SECR and GHG Protocol reports, the assurance pack ZIP.
- Never: App Store availability, customer names or results, "certified" or "guaranteed" compliance, figures other than the demo tenant's.
- Approved lines (homepage): "Carbon figures that hold up when someone checks them." "Open any figure and see how it was made." "The three documents most contractors need." "From site paperwork to a published figure." "Start your Carbon Reduction Plan".

## Workspace
- `videos/` is its own npm package (Remotion 4.0.529 pinned, React 19.2.4), excluded from the app's tsconfig, ESLint and Vitest.
- Kit in `src/kit/`, film in `src/videos/launch/`. Scripts: `compose.py` (score and SFX), `beats.py`, `stills.ts`, `render.ts`, `verify.py`.
- Chromium: `/opt/pw-browsers/chromium_headless_shell-1194` (no download).
- `out/` and `public/audio/` are gitignored; `compose.py` regenerates the audio.
