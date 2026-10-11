// Builds the dark theme stylesheet (pure, plus two file readers for the build
// script and the tests). Two things need a dark value:
//   1. Tailwind's palette (bg-gray-900, text-red-700 …). Its colours are CSS
//      variables on :root, so the dark block redefines them with the shade
//      swapped (50 ↔ 950, 100 ↔ 900 …). A pale tint becomes a deep one and
//      dark text becomes light, and a text-white on a dark fill turns dark
//      too, so each light-mode pair keeps its contrast inverted.
//   2. Arbitrary hex classes (text-[#111827], bg-[#F8F9FA] …). They are not
//      variables, so each class in the source gets one rule that restates it
//      in its dark value. The class is matched by its exact token, so a
//      class the source does not use gets no rule, and the test fails if a
//      used class has none.
// The output is committed as app/dark-theme.generated.css; `pnpm theme:build`
// rewrites it and a test fails when it is stale.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SHADE_SWAP: Record<number, number> = {
  50: 950, 100: 900, 200: 800, 300: 700, 400: 600,
  500: 500, 600: 400, 700: 300, 800: 200, 900: 100, 950: 50,
};

// Surfaces: near-white colours form a dark ladder where whiter means a little
// lighter, so a white card sits above the page in dark mode too. Everything
// else inverts its lightness and keeps hue and saturation.
const SURFACE_FROM = 0.93;
const SURFACE_LOW = 0.06;
const SURFACE_HIGH = 0.13;

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

/** The dark lightness for a light one, see the surface note above. */
export function darkLightness(l: number): number {
  if (l >= SURFACE_FROM) {
    return SURFACE_LOW + ((l - SURFACE_FROM) / (1 - SURFACE_FROM)) * (SURFACE_HIGH - SURFACE_LOW);
  }
  return 1 - l;
}

/** The dark counterpart of a light hex colour, as #rrggbb. */
export function invertHex(hex: string): string {
  const [h, s, l] = rgbToHsl(parseHex(hex));
  return toHex(hslToRgb(h, s, darkLightness(l)));
}

/** Palette declarations for the dark block, read from Tailwind's theme.css text. */
export function paletteDarkDeclarations(themeCss: string): string[] {
  const raw = new Map<string, string>();
  for (const m of themeCss.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
    raw.set(`${m[1]}-${m[2]}`, m[3].trim());
  }
  const families = new Set([...raw.keys()].map((k) => k.slice(0, k.lastIndexOf("-"))));
  const out: string[] = [];
  for (const family of [...families].sort()) {
    for (const [shade, swapped] of Object.entries(SHADE_SWAP)) {
      if (Number(shade) === swapped) continue;
      const value = raw.get(`${family}-${swapped}`);
      if (value) out.push(`  --color-${family}-${shade}: ${value};`);
    }
  }
  out.push(`  --color-white: ${invertHex("#ffffff")};`);
  out.push(`  --color-black: ${invertHex("#000000")};`);
  return out;
}

// One arbitrary hex token: optional variants, a utility base, the hex, and an
// optional opacity suffix (text-[#fff]/60). Matches only 3- and 6-digit hex.
const TOKEN_RE = /^((?:[a-z][a-z-]*:)*)([a-z][a-z-]*)-\[#((?:[0-9a-fA-F]{6})|(?:[0-9a-fA-F]{3}))\](?:\/(\d+))?$/;

/** Hex tokens in a source text, e.g. `text-[#111827]` or `hover:bg-[#F8F9FA]/50`. */
export function findHexTokens(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/(?<![\w\-[])((?:[a-z][a-z-]*:)*[a-z][a-z-]*-\[#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\](?:\/\d+)?)(?![\w\-\]])/g)) {
    found.add(m[1]);
  }
  return [...found].sort();
}

// The Tailwind base a token's colour goes to, as the CSS properties it sets.
const PROPS: Record<string, { props: string[]; suffix?: string }> = {
  bg: { props: ["background-color"] },
  text: { props: ["color"] },
  border: { props: ["border-color"] },
  "border-x": { props: ["border-left-color", "border-right-color"] },
  "border-y": { props: ["border-top-color", "border-bottom-color"] },
  "border-t": { props: ["border-top-color"] },
  "border-b": { props: ["border-bottom-color"] },
  "border-l": { props: ["border-left-color"] },
  "border-r": { props: ["border-right-color"] },
  ring: { props: ["--tw-ring-color"] },
  "ring-offset": { props: ["--tw-ring-offset-color"] },
  outline: { props: ["outline-color"] },
  fill: { props: ["fill"] },
  stroke: { props: ["stroke"] },
  accent: { props: ["accent-color"] },
  caret: { props: ["caret-color"] },
  decoration: { props: ["text-decoration-color"] },
  shadow: { props: ["--tw-shadow-color"] },
  from: { props: ["--tw-gradient-from"] },
  via: { props: ["--tw-gradient-via"] },
  to: { props: ["--tw-gradient-to"] },
  placeholder: { props: ["color"], suffix: "::placeholder" },
  divide: { props: ["border-color"], suffix: " > :not(:last-child)" },
};

const PSEUDO: Record<string, string> = {
  hover: ":hover",
  focus: ":focus",
  "focus-visible": ":focus-visible",
  active: ":active",
  disabled: ":disabled",
  placeholder: "::placeholder",
  file: "::file-selector-button",
};

/** One dark rule for a hex token, or throws when the token uses a shape this file does not handle. */
export function hexTokenRule(token: string): string {
  const m = TOKEN_RE.exec(token);
  if (!m) throw new Error(`Not a hex token: ${token}`);
  const variants = m[1].split(":").filter(Boolean);
  const base = PROPS[m[2]];
  if (!base) throw new Error(`No dark rule for the utility in ${token}`);
  if (variants.length > 1) throw new Error(`More than one variant in ${token}`);

  let scope = `[data-theme="dark"] `;
  let target = "";
  const [variant] = variants;
  if (variant === "group-hover") scope += ".group:hover ";
  else if (variant) {
    const pseudo = PSEUDO[variant];
    if (!pseudo) throw new Error(`No dark rule for the variant ${variant} in ${token}`);
    target += pseudo;
  }
  target += base.suffix ?? "";

  const dark = invertHex(`#${m[3]}`);
  const alpha = m[4] ? Number(m[4]) : null;
  const value = alpha === null ? dark : `color-mix(in srgb, ${dark} ${alpha}%, transparent)`;
  const decls = base.props.map((p) => `${p}: ${value};`).join(" ");
  return `${scope}[class~="${token}"]${target} { ${decls} }`;
}

export const DARK_HEADER = [
  "/* Generated by scripts/build-dark-theme.ts. Do not edit: run `pnpm theme:build`. */",
  "/* Palette shades swapped for the dark theme, and one rule per arbitrary hex class. */",
].join("\n");

/** The full generated stylesheet for the given Tailwind theme text and hex tokens. */
export function buildDarkCss(themeCss: string, tokens: readonly string[]): string {
  const palette = paletteDarkDeclarations(themeCss);
  const rules = [...tokens].sort().map(hexTokenRule);
  return [
    DARK_HEADER,
    "",
    '[data-theme="dark"] {',
    "  color-scheme: dark;",
    ...palette,
    "}",
    "",
    ...rules,
    "",
  ].join("\n");
}

/** Source files whose hex classes must be covered: app, components and lib, minus tests. */
export function sourceFiles(root: string, dirs = ["app", "components", "lib"]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== "__tests__" && name !== "node_modules") walk(full);
      } else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) {
        out.push(relative(root, full));
      }
    }
  };
  for (const d of dirs) walk(join(root, d));
  return out.sort();
}

/** Every hex token used by the source files under root. */
export function collectHexTokens(root: string): string[] {
  const all = new Set<string>();
  for (const file of sourceFiles(root)) {
    for (const t of findHexTokens(readFileSync(join(root, file), "utf8"))) all.add(t);
  }
  return [...all].sort();
}
