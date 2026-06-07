# tasteskill — Anti-Slop Frontend Skill

Source: https://github.com/Leonxlnx/taste-skill

This skill governs all UI work in CarbonSite. Before writing any frontend code, declare a one-line **Design Read** inferring page type, audience, and aesthetic direction — never default to AI visual clichés.

## Three Dials (declare before each task)

- `DESIGN_VARIANCE` (1–10): 1 = symmetric/safe, 10 = asymmetric/editorial
- `MOTION_INTENSITY` (1–10): 1 = static, 10 = cinematic
- `VISUAL_DENSITY` (1–10): 1 = airy gallery, 10 = dense dashboard

CarbonSite default: DESIGN_VARIANCE=3, MOTION_INTENSITY=4, VISUAL_DENSITY=6 (data-dense SaaS product)

## Hard Bans — Never Do These

- **Em-dash (`—`)** is forbidden everywhere — use periods, commas, line breaks, or hyphens instead. This is the #1 AI signature.
- **Three identical feature cards** in a row
- **Floating top-right sub-text paragraphs**
- **Split headers** (left headline + right explainer grid)
- **Eyebrows above every section** — max 1 per 3 sections
- **Premium-consumer palette default** (beige + brass + oxblood + espresso) — rotate through: cold luxury, forest, black-and-tan, cobalt-cream, terracotta-slate
- **Serif fonts as defaults** — only if brand explicitly requires editorial/luxury. Never Fraunces or Instrument_Serif.

## Layout Rules (Non-Negotiable)

- Hero must fit initial viewport; top padding capped at `pt-24`
- Navigation renders on one line at desktop (≤80px height)
- No 3+ consecutive image-text-split sections
- Bento grids have exactly as many cells as content items (no empty cells)
- Forms: labels above, helper text optional, errors below, no floating labels
- Card containers only when elevation communicates hierarchy

## Color & Contrast

- One accent color per page/section family, locked across all sections
- One corner-radius system (sharp, soft, or pill) — no mixing
- Button text WCAG AA compliant (4.5:1 minimum)
- No pure black or white — use off-black (zinc-950) and off-white (zinc-50/slate-50)

## Typography

- **Headlines:** `text-4xl md:text-6xl tracking-tighter`
- **Body:** `text-base text-gray-600 leading-relaxed max-w-[65ch]`
- Avoid Inter as default — use Geist, Outfit, Cabinet Grotesk, or Satoshi
- One sans-serif family per project

## Design System (CarbonSite)

CarbonSite uses: **shadcn/ui + Tailwind v4 + motion/react**

Never mix systems. Never import Fluent UI, Material Web, or Polaris alongside shadcn.

## Motion (when MOTION_INTENSITY > 4)

- Every animation must communicate something in one sentence (feedback, state, hierarchy)
- Banned: `window.addEventListener('scroll')` — use Motion `useScroll()` or CSS scroll-driven animations
- Max one marquee per page
- All motion above level 3 collapses to static under `prefers-reduced-motion`
- Isolated client components: any Motion lives in a leaf `'use client'` component

## Pre-Flight Checklist (Run Before Shipping Any UI)

- [ ] Zero em-dashes anywhere
- [ ] One theme (light/dark/auto) locked across page
- [ ] One accent color used identically throughout
- [ ] One corner-radius system applied consistently
- [ ] All buttons contrast-check (WCAG AA)
- [ ] No CTA labels wrapping to 2+ lines at desktop
- [ ] Hero fits initial viewport, top padding ≤ `pt-24`
- [ ] Hero has max 4 text elements
- [ ] Eyebrow count ≤ ceil(sectionCount / 3)
- [ ] No zigzag alternation beyond 2 consecutive image-text sections
- [ ] Real images used (not div-based fake screenshots)
- [ ] Motion motivated with one-sentence justification per animation
- [ ] `prefers-reduced-motion` wrapped for MOTION_INTENSITY > 3
- [ ] Mobile collapse explicit (`w-full`, `px-4`, `max-w-7xl mx-auto`)
- [ ] `min-h-[100dvh]` used, never `h-screen`
- [ ] Cleanup functions on all `useEffect` animations
