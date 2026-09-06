# UI/UX Pro Max — Design System Generator

Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

Design intelligence for MetricOra across web (Next.js + shadcn/ui) and mobile (Flutter). Apply this skill when any task affects how features look, feel, move, or are interacted with.

## 10 Priority Categories (Ranked by Impact)

### 1. Accessibility (CRITICAL)
- Contrast ratios: 4.5:1 for normal text, 3:1 for large text (WCAG AA)
- All interactive elements keyboard-navigable with visible focus states
- ARIA labels on icon-only buttons, charts, and complex widgets
- Charts must have accessible text summaries (MetricOra requirement: every chart needs a summary table)

### 2. Touch & Interaction (CRITICAL — applies to Flutter)
- Minimum 44×44px touch targets (iOS HIG + Material Design both require this)
- 8px minimum spacing between adjacent tap targets
- All destructive actions (reject, delete) require loading feedback within 80–150ms
- Swipe-to-approve on review queue must have visual affordance and snap-back physics

### 3. Performance (HIGH)
- Images: next/image for web (automatic WebP, lazy loading), cached_network_image for Flutter
- No layout shift on load (skeleton screens, not spinners for content areas)
- Dashboard numbers animate in on first load (Motion countup, not instant flash)

### 4. Style Selection (HIGH — MetricOra is a professional SaaS tool)
- Category: **Product UI** (not Marketing/Brand) — earned familiarity over distinctiveness
- Base: shadcn/ui + Tailwind v4 (web), Material 3 tokens via Flutter theme (mobile)
- Icon family: Lucide (web), Material Symbols (Flutter) — one family only, no mixing
- No emoji as UI elements — vector icons only

### 5. Layout & Responsive (HIGH)
- Mobile-first: design 375px wide first, then 768px, then 1280px+
- Dashboard cards: single column → 2-col → 3-col grid (CSS Grid, not Flexbox wrapping)
- Table/record lists: horizontal scroll on mobile, never compress columns below readable width
- Flutter: safe area insets respected (`SafeArea` widget on all scaffold roots)

### 6. Typography & Color (MEDIUM)
- Semantic color tokens (not hardcoded hex): `--color-primary`, `--color-destructive`, `--color-muted`
- Line height 1.5–1.75 for body text
- Chart/data colors: use accessible palette (avoid red/green as sole differentiators — add shape/pattern)
- MetricOra palette context: sustainability → greens work but must not be the only differentiator for accessibility

### 7. Animation (MEDIUM)
- Timing: 150–200ms for micro-interactions, 250–350ms for page transitions
- Always `transform` + `opacity` only
- `prefers-reduced-motion` respected at MOTION_INTENSITY > 3
- Flutter: `AnimatedSwitcher`, `Hero`, and `AnimatedContainer` for standard transitions

### 8. Forms & Feedback (MEDIUM — critical for import/data entry flows)
- Visible labels always (no placeholder-as-label anti-pattern)
- Inline validation: show on blur, not on keystroke (reduces anxiety)
- Error messages below the field, linked via `aria-describedby`
- Import form: multi-step progress indicator must show current step and total

### 9. Navigation Patterns (HIGH)
- Web: sidebar nav for org-scoped sections, top bar for global actions + user menu
- Flutter: bottom nav bar max 4 items; current tab visually distinct (not just color)
- Deep linking from push notifications must land on the exact resource, not the list
- Back navigation: predictable — never navigate to an unrelated section

### 10. Charts & Data (LOW — but visible in MetricOra dashboards)
- Always include legend or direct labels
- Color palettes: accessible 8-color diverging scale for scope breakdowns
- Responsive: mobile simplifies to bar/donut only (no complex scatter/bubble)
- 25 chart types available — for MetricOra use: bar (scope breakdown), line (trends), donut (category share), progress bar (target tracking)

## Pre-Delivery Validation

Before marking any UI task complete:
- [ ] Touch targets ≥ 44px (Flutter) / clickable areas ≥ 44px (web)
- [ ] Contrast ratio verified (use browser DevTools or axe extension)
- [ ] Keyboard navigation tested (Tab through all interactive elements)
- [ ] Loading/empty/error states all handled (never leave a blank div)
- [ ] ARIA labels on all icon-only buttons and chart wrappers
- [ ] Reduced motion: test with `prefers-reduced-motion: reduce` in DevTools
- [ ] Dark mode: tested if the app supports it
- [ ] Mobile: tested at 375px width
