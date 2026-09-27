/** MetricOra tokens for films, as hex (anything that animates must be hex). Sources in BRAND.md. */
export const C = {
  stage: "#0B100E",
  stage2: "#131A17",
  stage3: "#1B2420",
  onDark: "#F1F4F2",
  onDark2: "#B4BFBA",
  onDark3: "#87938E",
  accentLit: "#FB8A4B",
  accent: "#C2410C",
  accentHover: "#9A3412",
  page: "#F9FAFB",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  text2: "#374151",
  muted: "#6B7280",
  activeBg: "#FFF7ED",
  activeBorder: "#FED7AA",
  approvedBg: "#DCFCE7",
  approvedFg: "#166534",
  amberBg: "#FEF3C7",
  amberFg: "#92400E",
  scope1: "#EA580C",
  scope2: "#2563EB",
  scope3: "#16A34A",
  logoFrom: "#F97316",
  logoTo: "#FBBF24",
  // Field app (Flutter, Material 3 seeded from #1B5E20).
  appSeed: "#1B5E20",
  appSurface: "#F7FBF2",
  appContainer: "#DDEBD5",
  appOn: "#1A1C19",
  appOn2: "#43483F",
} as const;

export const FONT = '"Geist", -apple-system, "Helvetica Neue", Arial, sans-serif';
export const MONO = '"Geist Mono", ui-monospace, monospace';

/** Landing ease from the marketing site. */
export const LAND = [0.22, 1, 0.36, 1] as const;
