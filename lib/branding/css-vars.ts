// Tenant branding → CSS custom properties. Pure: no database, no React.
//
// Product primary is the orange in app/globals.css (#c2410c). A tenant colour
// only replaces it when it is a valid hex, is not the schema default
// (TenantBranding.primaryHex = #0f4c8a, which means "not chosen") and gives
// white button text at least WCAG AA contrast (4.5:1).

export const TENANT_DEFAULT_PRIMARY = "#0f4c8a";
export const MIN_PRIMARY_CONTRAST = 4.5;

const FONTS = new Set(["Inter", "Roboto", "Open Sans", "Lato", "Montserrat"]);

export interface BrandingInput {
  primaryHex: string | null;
  accentHex: string | null;
  fontFamily: string | null;
}

/** "#AbC123" or "abc123" → "#abc123"; anything else → null. */
export function normaliseHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

/** WCAG contrast ratio of a #rrggbb colour against white. */
export function contrastWithWhite(hex: string): number {
  const linear = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return 1.05 / (luminance + 0.05);
}

/** Custom properties for a tenant. Empty when nothing usable is set. */
export function brandingVars(branding: BrandingInput | null): Record<string, string> {
  if (!branding) return {};
  const vars: Record<string, string> = {};

  const primary = normaliseHex(branding.primaryHex);
  if (primary && primary !== TENANT_DEFAULT_PRIMARY && contrastWithWhite(primary) >= MIN_PRIMARY_CONTRAST) {
    vars["--color-primary"] = primary;
    vars["--color-brand-primary"] = primary;
    vars["--color-forest-ink"] = primary;
  }

  // Accent has no product consumer yet; the legacy names are kept as before.
  const accent = normaliseHex(branding.accentHex);
  if (accent) {
    vars["--color-mist-blue"] = accent;
    vars["--color-brand-accent"] = accent;
  }

  // Fonts are not loaded by the app, so this only changes the fallback stack.
  if (branding.fontFamily && FONTS.has(branding.fontFamily)) {
    vars["--font-sans"] = `"${branding.fontFamily}", system-ui, sans-serif`;
  }

  return vars;
}

/** `:root { … }` block for a <style> element, or "" when there are no vars. */
export function brandingCss(vars: Record<string, string>): string {
  const entries = Object.entries(vars);
  if (entries.length === 0) return "";
  return `:root { ${entries.map(([name, value]) => `${name}: ${value};`).join(" ")} }`;
}
