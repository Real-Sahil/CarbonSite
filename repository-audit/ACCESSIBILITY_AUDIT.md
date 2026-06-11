# Accessibility Audit — CarbonSite

---

## Summary Score: 38 / 100

The web app has partial WCAG 2.1 Level AA compliance for basic form interactions but fails on structural landmarks, focus management, color-only status indicators, and responsive text. The Flutter app has zero accessibility implementation — no `Semantics` widgets, no screen reader labels, no dynamic text scaling, and no keyboard navigation.

---

## Web App (Next.js)

### WCAG 2.1 Level AA Assessment

#### 1.1 Text Alternatives — PARTIAL

**Issue: Sidebar navigation icons lack `aria-label` on the icon element**  
File: `components/org-sidebar.tsx:132`

```tsx
<Icon
  className={cn("h-4 w-4 shrink-0", ...)}
/>
```

The Lucide icons are SVGs without `aria-hidden="true"` or `aria-label`. Since the parent `<Link>` includes visible text (`{item.label}`), the icon should be hidden from screen readers to prevent duplicate announcement.

**Fix:**
```tsx
<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
```

**Severity:** Low (text label is present, but noisy for screen readers)

---

**Issue: Avatar image fallback is non-descriptive**  
File: `components/org-sidebar.tsx:150`

```tsx
<AvatarImage src={undefined} alt={user.name ?? user.email} />
<AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
```

`src={undefined}` means the `<img>` is never rendered — only the fallback initials text is shown. The `alt` attribute on the never-rendered img is not read. The fallback `<div>` containing initials characters has no accessible name.

**Fix:** Add `aria-label` to the `<Avatar>` element:
```tsx
<Avatar className="h-8 w-8 shrink-0" aria-label={user.name ?? user.email}>
```

---

#### 1.3 Adaptable — FAIL

**Issue: No `<main>` landmark or skip navigation link**  
Files: `app/(app)/orgs/[orgId]/layout.tsx`, `app/layout.tsx`

The app layout renders a sidebar and a `<main>` element, but there is no "Skip to main content" link before the sidebar. Keyboard users and screen reader users must tab through all 7 navigation items on every page load.

**Fix:**
```tsx
// At the top of OrgLayout, before the sidebar:
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
             focus:z-50 focus:px-4 focus:py-2 focus:bg-green-700 focus:text-white 
             focus:rounded-md focus:text-sm"
>
  Skip to main content
</a>
// On the <main> element:
<main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-auto">
```

**Severity:** High — WCAG 2.4.1 Bypass Blocks (Level A)

---

**Issue: Status badges use color as the only differentiator**  
File: `app/(app)/orgs/[orgId]/submissions/page.tsx:36`

The `STATUS_CLASSES` map applies different background/text colors for different statuses. While the status text is also displayed, the colored badge itself is not annotated. Color-blind users may struggle to distinguish states at a glance.

Status chips have no `role` or accessible description — they are `<span>` elements without any ARIA attributes.

**Fix:**
```tsx
<span
  role="status"
  className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_CLASSES[s.status])}
  aria-label={`Status: ${STATUS_LABELS[s.status] ?? s.status}`}
>
  {STATUS_LABELS[s.status] ?? s.status}
</span>
```

**Severity:** Medium — WCAG 1.4.1 Use of Color (Level A)

---

#### 1.4 Distinguishable — PARTIAL

**Issue: Placeholder text color `text-slate-400` may fail contrast**  
File: `components/ui/input.tsx:12`

`slate-400` is approximately `#94a3b8`. Against a white background (`bg-white`) the contrast ratio is approximately 2.5:1, well below the WCAG AA threshold of 4.5:1 for normal text.

**Fix:** Use `placeholder:text-slate-500` (contrast ~3.9:1 — borderline AA) or `placeholder:text-slate-600` (contrast ~5.9:1 — passes AA).

**Severity:** Medium — WCAG 1.4.3 Contrast (Minimum) (Level AA)

---

**Issue: Focus ring uses `ring-green-700` but no visible offset**  
File: `components/ui/input.tsx:12`

```
focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-0
```

`ring-offset-0` removes the white gap between element border and ring. On dark-bordered inputs this reduces the visible contrast of the focus ring.

**Fix:** Change to `focus-visible:ring-offset-2` to restore the white buffer.

---

#### 2.1 Keyboard Accessible — PARTIAL

**Issue: Dropdown menu trigger in sidebar is a `<button>` (good) but role is missing**  
File: `components/org-sidebar.tsx:149`

```tsx
<button className="flex items-center gap-3 w-full ..." ...>
```

The element is a button, which is correct. However, `ChevronDown` icon has no `aria-hidden`. The button has no `aria-haspopup="menu"` or `aria-expanded` state.

**Fix:**
```tsx
<button
  aria-haspopup="menu"
  aria-expanded={open}     // wire to Radix open state
  className="..."
>
  <Avatar .../>
  <div>...</div>
  <ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-400 shrink-0" />
</button>
```

---

#### 2.4 Navigable — FAIL

**Issue: Page titles not set per-route**  
No `<title>` or `metadata` export exists in any page component. All pages will show the app root title set in `app/layout.tsx` (currently just "CarbonSite").

**Fix:** Add per-page metadata:
```tsx
// app/(app)/orgs/[orgId]/submissions/page.tsx
export async function generateMetadata({ params }: SubmissionsPageProps) {
  const { orgId } = await params;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  return { title: `Field Submissions — ${org?.name ?? orgId} | CarbonSite` };
}
```

**Severity:** High — WCAG 2.4.2 Page Titled (Level A)

---

#### 3.3 Input Assistance — PARTIAL

**Issue: Form error messages use `role="alert"` correctly**  
Files: `app/(auth)/sign-in/page.tsx:83`, `components/ui/input.tsx`  
This is correctly implemented — `role="alert"` is present on error paragraphs.

**Issue: No `aria-describedby` linking inputs to error messages**  
When validation fails, the error `<p>` appears below the form but has no `id` — the input has no `aria-describedby`. Screen readers will announce the input description separately from the error.

**Fix:**
```tsx
<Input id="email" aria-describedby={error ? "email-error" : undefined} ... />
{error && <p id="email-error" role="alert" ...>{error}</p>}
```

---

#### 4.1 Compatible — PARTIAL

**Issue: `<nav>` landmark has no accessible name**  
File: `components/org-sidebar.tsx:117`

```tsx
<nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
```

Multiple `<nav>` elements on a page require `aria-label` to distinguish them for screen reader navigation.

**Fix:** `<nav aria-label="Organisation navigation" ...>`

---

### Dyslexia / ADHD / Cognitive Accessibility

- No font choice options (dyslexia-friendly fonts like OpenDyslexic not offered)
- Long form validation is inline (good — immediate feedback)
- No reading line length control (some pages use `max-w-4xl` which helps)
- Status states use color + text (good for ADHD/cognitive load)
- No distraction-free / reduced-motion option (no `prefers-reduced-motion` media query checks)

### Dark Mode Support

No dark mode styles exist. The app uses hardcoded Tailwind color utilities (`slate-50`, `white`, `green-700`) without CSS custom properties that would allow a dark variant. Users who rely on system dark mode for visual comfort or photosensitivity have no option.

---

## Flutter App

### Screen Reader Support — FAIL

**No `Semantics` widgets exist anywhere in the codebase.**

| Screen | Screen reader state |
|---|---|
| `InviteScreen` | Text fields have Flutter default labels; buttons have no semantic label |
| `PinSetupScreen` | PIN dots have no semantic description; number pad buttons are unlabeled |
| `HomeScreen` | Project cards are unlabeled |
| `CaptureScreen` | Stub — N/A |
| `SubmissionsScreen` | Stub — N/A |

**Critical fix for `PinSetupScreen`:**
```dart
// Pin dot
Semantics(
  label: isEntered ? 'PIN digit entered' : 'PIN digit empty',
  child: Container(...)
)

// Number pad button
Semantics(
  button: true,
  label: digit == 'del' ? 'Delete' : digit,
  child: GestureDetector(...)
)
```

---

### Dynamic Text Scaling — FAIL

Hardcoded font sizes throughout: `fontSize: 26`, `fontSize: 16`, `fontSize: 12`. No use of `textScaler` or `MediaQuery.textScalerOf(context)`. Users with accessibility font size settings (often 150–200%) will see clipped or overflowing text.

**Recommended fix:** Use `Theme.of(context).textTheme` styles which respect text scaling:
```dart
Text('Enter your name', style: Theme.of(context).textTheme.titleLarge)
```

---

### Color Contrast — PARTIAL

`ThemeData(colorSchemeSeed: Color(0xFF166534))` generates a Material 3 color scheme from green-800. Material 3 color system is designed for WCAG AA contrast by default. However, hardcoded inline colors (e.g., `Colors.grey.shade300`, `Colors.grey.shade600` in pin setup) may not meet the 4.5:1 ratio.

---

### Motor Impairment / Touch Targets — FAIL

Pin digit buttons in `PinSetupScreen` use `_DigitButton` which renders as a 72×72 circle — adequate. But the delete button occupies the same 72×72 space. No custom hit area expansion via `MaterialTapTargetSize` or padding.

The `_NumPad` widget uses a 4-column `GridView` — the empty cell in the bottom row is a dead zone. This is acceptable but the grid has no `semanticsLabel`.

---

### Localization / Internationalization — FAIL

`MaterialApp.router` has no `localizationsDelegates` or `supportedLocales`. The app is English-only with hardcoded strings. For a product targeting subcontractors in the UK construction industry (who may speak Polish, Romanian, or other languages), this is a gap.

---

## Summary Table

| Category | Web | Flutter |
|---|---|---|
| Screen reader support | Partial | None |
| Keyboard navigation | Partial | N/A (touch first) |
| Skip navigation | Missing | N/A |
| Color contrast | Partial (placeholder fail) | Partial |
| ARIA landmarks | Partial | N/A |
| Error association | Partial | N/A |
| Page titles | Missing | N/A |
| Dynamic text scaling | Not tested | Fail |
| Dark mode | Missing | Partial (Material 3) |
| Reduced motion | Missing | Missing |
| Localization | Not applicable | Missing |
| Focus management | Partial | N/A |
