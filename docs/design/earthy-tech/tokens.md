# Design tokens: Earthy Tech

Status: draft for review. Values below are a specification. No stylesheet has been written; once approved, each row becomes one CSS custom property with the name shown.

## Intent

Warm, mineral and grounded. The page should feel like good paper under daylight, with figures set like a field notebook. Mathematical rigour comes from mono numerals and exact alignment, warmth comes from the ground colour, the serif headings and the soft shapes. No electric blue, no clinical grey, no default component-library look.

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
| `--color-moss-300` | #9DB89A | Chart fills, soft emphasis |
| `--color-moss-500` | #4F7F5F | Large graphics only (below 4.5:1 for small text) |
| `--color-moss-700` | #2F5D43 | Primary actions, links, positive deltas (6.63 on ground) |
| `--color-moss-900` | #1E3A2B | Headline accent, pressed state (10.82 on ground) |

### Terracotta (attention, hotspots, "look here")

| Token | Value | Use |
|---|---|---|
| `--color-terra-100` | #F1D9CC | Tints behind warnings |
| `--color-terra-300` | #E39A7C | Chart highlight, dark theme text |
| `--color-terra-600` | #B5502F | Large graphics and fills only (4.42 on ground, under 4.5) |
| `--color-terra-700` | #9A4126 | Text, links, negative deltas (5.81 on ground) |

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
| `--color-action` | moss-700 |
| `--color-action-hover` | moss-900 |
| `--color-on-action` | surface (7.10 on moss-700) |
| `--color-positive` | moss-700 |
| `--color-negative` | terra-700 |
| `--color-caution` | ochre-700 |
| `--color-focus-ring` | moss-700, 2px, 2px offset |
| `--color-demo` | ochre-200 background with ochre-700 text, for the Demo data label |

Rule: a delta is never shown by colour alone. Direction is always carried by an arrow or sign and the word ("lower", "higher").

### Chart palette

Order for categorical series: moss-700, terra-600, clay-200 darkened to #A89A7E for lines, moss-300, ochre-700, sky-mute. A chart with more than six series groups the rest into "Other". Series are told apart by direct labels, not by a legend that depends on hue alone. Sequential scale for intensity runs moss-100 to moss-900. Diverging scale for change runs moss-700 through ground to terra-600.

### Dark theme

A dark theme is a considered inversion, not a filter. Ground becomes #16221A (deep moss-black), surface #1D2B22, line #2C3C32, ink #EDE6D6 (13.22 on dark ground), ink-2 #C9C2B0, action moss-200 #B9CFB8 (9.92 on dark ground), negative terra-300 (7.18 on dark ground). The film grain drops to a lower opacity. Dark follows the system setting; there is no in-app switch required.

## Texture

| Token | Value | Use |
|---|---|---|
| `--grain-opacity` | 0.035 light, 0.05 dark | Film grain layer over the ground |
| `--grain-scale` | 160px tile, fine monochrome noise | Pattern size |
| `--grain-blend` | multiply on light, screen on dark | Blend mode |

Grain sits only on the page ground, never over text, charts or tiles. It is a static image, not animated, and it is omitted when the user asks for reduced transparency or the device is low power.

## Typography

Principle: serif for what the page says, sans for what the page does, mono for what the page measures.

| Token | Role | Direction |
|---|---|---|
| `--font-display` | Serif headings, the greeting | A warm text serif with sturdy strokes and good numerals. Candidates for review: Source Serif 4, Newsreader, Literata. Fraunces and Instrument Serif are excluded by the project's design rules. Needs an open licence check before use |
| `--font-body` | Interface and paragraphs | A humanist sans with open apertures. Candidates: Geist (already used in the current product), Public Sans, Figtree |
| `--font-data` | Figures, ledger, formulas | A mono with tabular, slashed-zero numerals. Candidates: JetBrains Mono, IBM Plex Mono, Geist Mono |

All three are loaded as variable fonts, subset to Latin, with a size-adjusted system fallback so the page does not jump.

### Type scale (rem, base 16px)

| Token | Size / line height | Face | Use |
|---|---|---|---|
| `--text-display` | 2.75 / 1.1 | display | The greeting on desktop (2rem on phone) |
| `--text-h1` | 2.0 / 1.15 | display | Page titles |
| `--text-h2` | 1.5 / 1.25 | display | Tile headlines |
| `--text-h3` | 1.125 / 1.35 | body, semibold | Section labels |
| `--text-body` | 1.0 / 1.6 | body | Paragraphs, 65ch maximum |
| `--text-small` | 0.875 / 1.5 | body | Captions, helper text |
| `--text-micro` | 0.75 / 1.4 | body, medium | Chips, units (never the only carrier of meaning) |
| `--text-figure-xl` | 3.0 / 1.0 | data | Headline figure inside a sentence |
| `--text-figure` | 1.5 / 1.1 | data | Tile figures |
| `--text-cell` | 0.8125 / 1.4 | data | Ledger cells |

Figures always use tabular numerals and right-align in tables. Units sit in `--text-small` beside the figure, never inside it. Headlines use sentence case. Letter-spacing on display text is slightly tight (-0.01em), on mono it is neutral.

## Shape

One system: soft, with relaxed corners that feel cut by hand rather than a perfect circle.

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 6px | Chips, inputs |
| `--radius-sm` | 10px | Buttons |
| `--radius-md` | 18px | Tiles at rest |
| `--radius-lg` | 28px | Hero tile, drawer top corners |
| `--radius-organic` | 22px 18px 24px 16px | Optional uneven corners for bento tiles, so the grid reads as hand-fitted. Applied consistently, never randomly per tile |
| `--radius-hover-delta` | +4px | How far a tile's radius relaxes on hover |

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

Only transform and opacity animate. Physics-based means springs, not timed curves.

| Token | Value | Use |
|---|---|---|
| `--motion-spring-soft` | stiffness 260, damping 24 | Tile hover, expand in place |
| `--motion-spring-snap` | stiffness 420, damping 32 | Toggles, chips |
| `--motion-lift` | 2px | Hover rise |
| `--duration-micro` | 150ms | Colour, focus |
| `--duration-base` | 200ms | Hover lift and radius relax |
| `--duration-layout` | 400ms | Shared-layout expansion, drawer |
| `--ease-out` | cubic-bezier(0.22, 1, 0.36, 1) | Entrances |
| `--ease-in` | cubic-bezier(0.64, 0, 0.78, 0) | Exits, which are faster than entrances |
| `--stagger` | 40ms | List and tile entrance |

Hover effects apply only where a pointer exists. Under reduced motion every spring becomes an instant change, the greeting appears at once, counters do not tween and the Sankey does not animate its bands in.

## Density

Two settings, comfortable (default) and compact for analysts. Compact reduces tile padding to `--space-4`, ledger row height from 44px to 32px and the body size by one step on tables only. Touch targets stay at 44px on touch devices in either setting.

## Accessibility checks already run

Contrast ratios above were computed from the hex values, against the ground colour unless stated. Text pairs used for reading all reach 4.5:1 or better (ink 12.99, ink-2 6.76, ink-3 4.96, moss-700 6.63, terra-700 5.81, ochre-700 5.91). Two tokens fall short for small text and are restricted to large graphics and fills: terra-600 (4.42) and moss-500. Button text on moss-700 is 7.10 and on terra-700 is 6.22. Tinted chips: moss-700 on moss-100 is 5.91, terra-700 on terra-100 is 4.92. Dark theme text pairs are 9.92 or better.

Still to verify once visual proofs exist: contrast of chart fills against each other and the ground, grain legibility effects at 200% zoom, and the three font candidates' licences.

## Open questions for review

1. Is a serif display face acceptable for all headings, or only the greeting and page titles, with tile headlines in the body sans? The first is warmer, the second is easier to scan at density.
2. Terracotta carries "look here" and also negative deltas. Should a negative change use a separate, quieter hue so that attention and bad news are not the same colour?
3. Should the organic uneven radius ship at all? It is the most distinctive element and also the one most likely to look careless if a tile is resized.
