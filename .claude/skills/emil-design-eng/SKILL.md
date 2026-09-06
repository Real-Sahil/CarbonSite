# Emil Kowalski — Design Engineering Skill

Source: https://github.com/emilkowalski/skill  
Philosophy: https://emilkowal.ski/skill

This skill encodes Emil Kowalski's design engineering philosophy for building interfaces that feel right. "All those unseen details combine to produce something that's just stunning" — the aggregate of small, correct decisions creates interfaces people love without consciously knowing why.

## Core Philosophy

- Taste is trained through study and practice
- Invisible details compound into great experiences
- Beauty serves as a competitive differentiator
- Good defaults ship beautiful; edge cases handled invisibly (the Sonner approach)

## Animation Decision Framework

Before adding any animation, answer:
1. **Frequency**: Is this interaction repeated constantly? Keep it short/subtle.
2. **Purpose**: Does the motion communicate state, hierarchy, or feedback — or is it decoration?
3. **Easing**: Use `spring` for natural feel, `ease-out` for entrances, `ease-in` for exits
4. **Duration**: 150–250ms for micro-interactions, 300–500ms for layout transitions

**Only animate `transform` and `opacity`.** Never animate `width`, `height`, `top`, `left`, or `padding` — these cause layout recalculation and drop frames.

CSS animations outperform JavaScript animations under load. Use CSS for simple states, Motion/React for gesture-driven and spring physics.

## Component Principles

**Buttons:**
- Need press feedback (scale down: `scale(0.97)` on active)
- Focus ring must be visible and distinct
- Loading state should not resize the button (use opacity, not removing text)

**Popovers / Dropdowns:**
- Scale from their trigger point (`transform-origin: top left` for top-left anchored triggers)
- Enter: scale from 0.95, fade in, 150ms spring
- Exit: faster than enter (100ms ease-in)

**Tooltips:**
- Animate on first hover per session; skip animation on subsequent hovers within session
- Delay of 300ms before showing (prevents tooltip flash on mouse pass-through)

**Dialogs / Sheets:**
- Sheet: slide from edge + slight scale (not pure slide — feels native)
- Dialog: scale from 0.95, not from 0.5 (too dramatic)
- Backdrop: fade in 200ms, never instant

## Advanced Techniques

- `clip-path` for reveals: `polygon(0 0, 100% 0, 100% 0, 0 0)` → `polygon(0 0, 100% 0, 100% 100%, 0 100%)`
- Stagger animations: 30–50ms delay between list items
- Gesture interactions: momentum + damping (drag should decelerate naturally, not stop abruptly)
- Number transitions: use `motion` `animate` on span content for counter animations in dashboards

## Performance

- Framer Motion's shorthand properties (`x`, `y`, `scale`) are hardware-accelerated; layout-affecting properties (`width`) are not
- Use `will-change: transform` sparingly — only on elements that animate continuously
- Measure with Chrome DevTools Performance tab: target 60fps (16ms budget), 120fps on ProMotion displays

## Accessibility

- Always respect `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
  ```
- Gate hover effects: `@media (hover: hover) { .btn:hover { ... } }`
- Animated content must not be the sole means of conveying information

## MetricOra Specific Applications

- Dashboard chart entrance: stagger bars/segments, 40ms delay, ease-out
- Import progress indicator: indeterminate to determinate, spring fill
- Form field validation: subtle shake on error (200ms, translateX ±4px × 3)
- Approval/rejection swipe: gesture-driven with momentum and snap-back
- Page transitions: shared layout animations for record → detail views
