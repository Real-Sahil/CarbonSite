# Design tokens: Earthy Tech

Status: revision 2, final for visual review. Incorporates the owner's decisions on typography, the split red, uniform radii and archival empty states. Values below are a specification. No stylesheet has been written; once approved, each row becomes one CSS custom property with the name shown.

## Intent

Warm, mineral and grounded. The page should feel like good paper under daylight, with figures set like a field notebook. Mathematical rigour comes from mono data labels and exact alignment. Warmth comes from the ground colour, the film grain, the serif greeting and the hover physics, not from unusual shapes. No electric blue, no clinical grey, no default component-library look.

## Colour

Naming: `--color-{role}-{step}`. Steps run light to dark within a family.

### Ground and surfaces

| Token | Value | Use |
|---|---|---|
| `--color-ground` | #F5EFE4 | Page background, a warm off-white |
| `--color-surface` | #FBF7EF | Tiles and cards |
| `--color-surface-sunk` | #EFE7D8 | Wells, table headers, input backgrounds |
| `--color-line` | #E3D9C6 | Hairlines and tile borders |
| `--color-line-strong` | #CFC2A8 | Dividers that need to be seen |

### Ink

| Token | Value | Contrast on ground | Use |
|---|---|---|---|
| `--color-ink` | #1F2A22 | 12.99 | Headings, figures |
| `--color-ink-2` | #4A5648 | 6.76 | Body text |
| `--color-ink-3` | #5F6A5B | 4.96 | Secondary labels, captions (smallest text allowed on ground) |

### Moss (primary, growth, "good")

| Token | Value | Use |
|---|---|---|
| `--color-moss-100` | #DCE6D8 | Tints, selected rows, chips |
| `--color-moss-200` | #B9CFB8 | Dark theme action and text (9.92 on dark ground) |
| `--color-moss-300` | #9DB89A | Chart fills, soft emphasis, archival sketch fill |
| `--color-moss-500` | #4F7F5F | Large graphics only (below 4.5:1 for small text) |
| `--color-moss-700` | #2F5D43 | Primary actions, links, positive deltas, sketch line work (6.63 on ground) |
| `--color-moss-900` | #1E3A2B | Headline accent, pressed state (10.82 on ground) |

### Terracotta (interactive highlight, "you can act here")

Terracotta no longer carries bad news. It marks what a person can touch.

| Token | Value | Use |
|---|---|---|
| `--color-terra-100` | #F1D9CC | Hover and selected tint behind interactive rows and tiles |
| `--color-terra-300` | #E39A7C | Chart highlight, archival sketch fill, dark theme interactive text (7.18 on dark ground) |
| `--color-terra-600` | #B5502F | Large graphics and fills only (4.42 on ground, under 4.5) |
| `--color-terra-700` | #9A4126 | Interactive text, links in running text, selected underline (5.81 on ground) |

### Brick (alerts and negative trends, "something is wrong")

A deeper, sharper red with a cooler, more saturated cast than terracotta, used for one job only.

| Token | Value | Use |
|---|---|---|
| `--color-brick-100` | #F3D4CB | Tint behind a compliance alert or a worsening trend |
| `--color-brick-300` | #E8806A | Dark theme text and icons (6.05 on dark ground, 5.44 on dark surface) |
| `--color-brick-600` | #A63A22 | Graphics, chart negative end of the diverging scale, borders (5.65 on ground) |
| `--color-brick-700` | #8E2B16 | Text and icons for alerts, negative deltas, failed checks (7.32 on ground, 7.84 on surface, 6.02 on brick-100) |

Warning: terra-700 and brick-700 are only 1.26:1 apart in luminance. They cannot be told apart by lightness. They are separated by role (a component uses one or the other), by hue and saturation, and by the rule that brick always carries an icon and the word ("Worse", "Missing", "Failed"). A visual proof must show both reds side by side before the pair is approved.

### Support

| Token | Value | Use |
|---|---|---|
| `--color-ochre-700` | #7A5410 | Caution text (5.91 on ground) |
| `--color-ochre-200` | #EBD9A8 | Caution tint |
| `--color-clay-200` | #D9CBB3 | Neutral chart series |
| `--color-sky-mute` | #7C93A0 | Rare third data hue, graphics only |

### Semantic roles

| Token | Maps to |
|---|---|
| `--color-action` | moss-700 (primary buttons, links on chrome) |
| `--color-action-hover` | moss-900 |
| `--color-on-action` | surface (7.10 on moss-700) |
| `--color-highlight` | terra-700 text on terra-100 tint (4.92), for hover, selected and "look here" states |
| `--color-on-highlight` | surface (6.22 on terra-700) |
| `--color-positive` | moss-700 |
| `--color-negative` | brick-700 |
| `--color-negative-tint` | brick-100 |
| `--color-alert` | brick-700, compliance alerts and failed checks |
| `--color-caution` | ochre-700 |
| `--color-dormant` | ink-3 text on surface-sunk, 1px line-strong border, used for the inactive CSRD module and any module that does not apply to the organisation |
| `--color-focus-ring` | moss-700, 2px, 2px offset |
| `--color-demo` | ochre-200 background with ochre-700 text, for the Demo data label |

Rules.

1. A delta is never shown by colour alone. Direction is carried by an arrow or sign and the word ("lower", "higher").
2. Brick red always appears with an icon and a word. It is never a bare coloured number.
3. A component uses terracotta or brick, never both.
4. The dormant state is deliberately neither a red nor an amber: an inactive regime is not a problem. It stays focusable and readable, with a tooltip.
5. Brick is never used for a decorative accent, a category in a chart or a marketing flourish.

### Chart palette

Order for categorical series: moss-700, terra-600, clay-200 darkened to #A89A7E for lines, moss-300, ochre-700, sky-mute. A chart with more than six series groups the rest into "Other". Series are told apart by direct labels, not by a legend that depends on hue alone. Sequential scale for intensity runs moss-100 to moss-900. Diverging scale for change runs moss-700 (improving) through ground to brick-600 (worsening), so the bad end of a trend reads as an alert and not as an interactive highlight. Terracotta is not part of the diverging scale.

### Dark theme

A dark theme is a considered inversion, not a filter. Ground becomes #16221A (deep moss-black), surface #1D2B22, line #2C3C32, ink #EDE6D6 (13.22 on dark ground), ink-2 #C9C2B0. Action is moss-200 (9.92 on dark ground). Interactive highlight is terra-300 (7.18). Negative and alert is brick-300 (6.05 on dark ground, 5.44 on dark surface). The archival sketches swap to their dark variant (see Empty-state artwork). The film grain drops to a lower opacity. Dark follows the system setting; there is no in-app switch required.

## Texture

| Token | Value | Use |
|---|---|---|
| `--grain-opacity` | 0.035 light, 0.05 dark | Film grain layer over the ground |
| `--grain-scale` | 160px tile, fine monochrome noise | Pattern size |
| `--grain-blend` | multiply on light, screen on dark | Blend mode |

Grain sits only on the page ground, never over text, charts, tiles or empty-state artwork. It is a static image, not animated, and it is omitted when the user asks for reduced transparency or the device is low power. With uniform radii, grain, the off-white ground and hover physics carry the physical feel.

## Typography

Principle: serif for what the page greets, mono for what the page measures, sans for everything the page does.

| Token | Role | Direction |
|---|---|---|
| `--font-display` | The narrative greeting and primary page titles only | A warm text serif with sturdy strokes and good numerals. Candidates for review: Source Serif 4, Newsreader, Literata. Fraunces and Instrument Serif are excluded by the project's design rules. Needs an open licence check before use |
| `--font-body` | All standard interface: navigation, buttons, forms, tile headline sentences, H2 and H3, paragraphs | A clean humanist sans with open apertures. Candidates: Geist (already used in the current product), Public Sans, Figtree |
| `--font-data` | Every data label: figures, units, ledger headers and cells, axis labels, chip values, table dates, hashes, formulas | A crisp mono with tabular, slashed-zero numerals. Candidates: JetBrains Mono, IBM Plex Mono, Geist Mono |

All three are loaded as variable fonts, subset to Latin, with a size-adjusted system fallback so the page does not jump. Serif is a single weight and a single style to keep the payload small, since it appears in two places.

### Type scale (rem, base 16px)

| Token | Size / line height | Face | Use |
|---|---|---|---|
| `--text-display` | 2.75 / 1.1 | display | The greeting on desktop (2rem on phone) |
| `--text-h1` | 2.0 / 1.15 | display | Primary page titles only (Executive Summary, Carbon, Social, Audit) |
| `--text-h2` | 1.5 / 1.25 | body, semibold | Tile headline sentences and section titles |
| `--text-h3` | 1.125 / 1.35 | body, semibold | Section labels |
| `--text-body` | 1.0 / 1.6 | body | Paragraphs, 65ch maximum |
| `--text-small` | 0.875 / 1.5 | body | Captions, helper text |
| `--text-micro` | 0.75 / 1.4 | body, medium | Chips and tags (never the only carrier of meaning) |
| `--text-figure-xl` | 3.0 / 1.0 | data | Headline figure inside a sentence |
| `--text-figure` | 1.5 / 1.1 | data | Tile figures |
| `--text-data` | 0.875 / 1.4 | data | Units, chip values, axis labels, dates, hashes |
| `--text-cell` | 0.8125 / 1.4 | data | Ledger cells and ledger headers |

Figures use tabular numerals and right-align in tables. A figure inside a sentence is set in mono while the surrounding words stay sans, so the number reads as measured. Units sit in `--text-data` beside the figure, never inside it. Headlines use sentence case. Letter-spacing on display text is slightly tight (-0.01em), on mono it is neutral.

A secondary page (a settings page, a drawer) takes its title in sans h2. If a page is not one of the four primary modules, it does not use the serif.

## Shape

One system, uniform and soft. No uneven radii, no radius that changes on hover.

| Token | Value | Use |
|---|---|---|
| `--radius-control` | 12px | Buttons, inputs, chips, tags, tooltips, table-row focus |
| `--radius-card` | 16px | Bento tiles, cards, drawer, dialog, sheet, empty-state frame |

Nested elements inside a 16px card use 12px, so the inner and outer curves stay visually concentric with the 16px padding they sit in. Sankey bands, charts and avatars follow their own geometry and do not take a radius token. Pills are not used; a chip is 12px, not fully round.

## Spacing

Base unit 4px. Scale: `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 24, `--space-6` 32, `--space-7` 48, `--space-8` 72. Bento gap is `--space-4` on desktop and `--space-3` on phone. Page gutter is 16px on phone and 40px on wide screens. Tile padding is `--space-5`, reduced to `--space-4` in compact density.

## Elevation

Tiles are mostly flat, separated by a hairline and a warm shadow, never a grey one.

| Token | Value | Use |
|---|---|---|
| `--shadow-rest` | 0 1px 0 line, 0 1px 2px rgba(60, 45, 20, 0.06) | Tiles at rest |
| `--shadow-lift` | 0 6px 18px rgba(60, 45, 20, 0.10) | Hover and drag |
| `--shadow-float` | 0 16px 40px rgba(60, 45, 20, 0.16) | Drawer, dialog |

Shadow colour is a warm brown at low opacity so it never reads as grey.

## Motion

Only transform and opacity animate. Physics-based means springs, not timed curves. Hover physics is the main source of the physical feel: a tile lifts and its shadow deepens. Its radius and size do not change.

| Token | Value | Use |
|---|---|---|
| `--motion-spring-soft` | stiffness 260, damping 24 | Tile hover, expand in place |
| `--motion-spring-snap` | stiffness 420, damping 32 | Toggles, chips |
| `--motion-lift` | 2px | Hover rise, with `--shadow-rest` easing to `--shadow-lift` |
| `--duration-micro` | 150ms | Colour, focus |
| `--duration-base` | 200ms | Hover lift |
| `--duration-layout` | 400ms | Shared-layout expansion, drawer |
| `--ease-out` | cubic-bezier(0.22, 1, 0.36, 1) | Entrances |
| `--ease-in` | cubic-bezier(0.64, 0, 0.78, 0) | Exits, which are faster than entrances |
| `--stagger` | 40ms | List and tile entrance |

Hover effects apply only where a pointer exists. Under reduced motion every spring becomes an instant change, the greeting appears at once, counters do not tween and the Sankey does not animate its bands in.

### Bloom (empty-state to data transition)

| Token | Value | Use |
|---|---|---|
| `--bloom-fill` | 700ms, ease-out, fill reveals from the base of the drawing upward | Colour fills the sketch once a source connects |
| `--bloom-hold` | 300ms | The finished sketch rests before the hand-off |
| `--bloom-handoff` | `--duration-layout` (400ms), shared layout transition | Sketch fades and scales into the widget it becomes |
| `--bloom-plays` | once per source | Not repeated on later visits or reconnects |

The fill is a clip reveal (transform and opacity only), never an animated gradient. Under reduced motion there is no bloom: the sketch swaps to its filled state and the widget replaces it at once. Any user action, or data that arrives sooner than the animation, cuts it short. The bloom never delays access to the data.

## Empty-state artwork

Archive tokens for the vintage sketches. Each empty state pairs one public-domain image with a sentence written by a person.

| Token | Value | Use |
|---|---|---|
| `--art-line` | moss-700 (dark theme: moss-200) | Cleaned line layer of the sketch |
| `--art-fill-a` | moss-300 | Primary fill layer, leaves and structure |
| `--art-fill-b` | terra-300 | Accent fill layer, one small element per sketch (a flower, a doorway) |
| `--art-paper` | transparent | The sketch sits on the page ground, never on a cream box |
| `--art-size-lg` | 360px wide | Full-page empty state |
| `--art-size-md` | 240px wide | Tile empty state |
| `--art-size-sm` | 120px wide | Table and drawer empty state |

Rules.

1. Subject matter: 19th-century botanical plates for Carbon and Social, architectural drawings and plans for Audit and Imports.
2. Sources must be public domain. Candidate archives: Biodiversity Heritage Library, Internet Archive, Wikimedia Commons. The licence of each image is checked individually and recorded in `docs/THIRD_PARTY_SOURCES.md` before it is added. An image whose status cannot be confirmed is not used.
3. Cleaning: remove paper stain, text, plate numbers and borders, then trace to a single-colour line layer plus a separate flat fill layer, so the two can be tinted independently from tokens.
4. Tint comes from tokens only. No hard-coded colour in an image file.
5. Every image has alt text that describes the drawing in a short phrase, and the empty-state sentence does not rely on the image.
6. Brick red never appears in artwork.
7. Grain does not overlay artwork.

## Density

Two settings, comfortable (default) and compact for analysts. Compact reduces tile padding to `--space-4`, ledger row height from 44px to 32px and the body size by one step on tables only. Touch targets stay at 44px on touch devices in either setting.

## Accessibility checks already run

Contrast ratios above were computed from the hex values, against the ground colour unless stated.

Text pairs used for reading all reach 4.5:1 or better: ink 12.99, ink-2 6.76, ink-3 4.96, moss-700 6.63, terra-700 5.81, ochre-700 5.91, brick-700 7.32 (7.84 on surface). Tokens that fall short for small text and are restricted to large graphics and fills: terra-600 (4.42) and moss-500. Brick-600 reaches 5.65 and may be used for small text only where brick-700 is unavailable, such as a chart label on a coloured fill; the default is brick-700.

Button text on moss-700 is 7.10 and on terra-700 is 6.22. Tinted chips: moss-700 on moss-100 is 5.91, terra-700 on terra-100 is 4.92, brick-700 on brick-100 is 6.02.

Dark theme: moss-200 9.92, terra-300 7.18, brick-300 6.05 on the dark ground and 5.44 on the dark surface. All are 4.5:1 or better.

Two-red separation: terra-700 and brick-700 differ by only 1.26:1 in luminance, so lightness cannot separate them. They are separated by role, by an icon and a word on every brick instance, and by never appearing in one component. This is the single largest open risk in the palette and must be tested with a side-by-side proof, including under simulated red-green colour deficiency, before approval.

Phase 7 recheck, from the token hex values: the dormant state's ink-3 on surface-sunk is 4.62 in light and 6.84 in dark, so it passes. Dark ink-3 on surface is 5.79 and ink-2 on surface 8.32. Moss-500 fills on sunk reach 3.77, above the 3:1 needed for graphics. Card borders (line-strong on surface, 1.65) are decoration only: no card relies on its border to be found, so they carry no contrast requirement. The focus ring is moss-700 (7.10 on surface) in light and moss-200 (8.92) in dark.

Preference handling in `app/globals.css`: reduced motion removes hover lift and press scale; reduced transparency makes the tab bar solid; forced colours replaces shadows with system-colour borders and the focus ring with `Highlight`. Hover effects sit inside `@media (hover: hover)`.

Still to verify once visual proofs exist: contrast of chart fills against each other and the ground, grain legibility effects at 200% zoom, the three font candidates' licences, and the dormant state's legibility (ink-3 on surface-sunk).

## Open questions for review

1. Do the two reds stay distinguishable in a side-by-side proof, in light, in dark and under simulated colour deficiency? If not, the fallback is to shift brick darker and more magenta, or to drop the tint and rely on icon and word alone.
2. Which serif, sans and mono pairing? The licences of all nine candidates are unchecked.
3. Archive shortlist: up to twelve sketches (botanical for Carbon and Social, architectural for Audit and Imports), each with source and licence recorded. Nothing is loaded until the licence is confirmed.
