// The appearance a person picks for the org app. Stored per user
// (users.theme_preference, read with the session) and mirrored in a cookie so
// the first paint already uses it. Light is the default; "system" follows the OS.

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const THEME_COOKIE = "metricora-theme";
export const THEME_ATTRIBUTE = "data-theme";
// The dark stylesheet only applies under the org app, so the marketing site
// and the auth pages keep their light palette whatever the cookie says.
export const ORG_APP_PATH = "/orgs/";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function parseThemeChoice(value: unknown): ThemeChoice | null {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value)
    ? (value as ThemeChoice)
    : null;
}

/** Light unless the choice is dark, or system with a dark OS setting. */
export function resolveTheme(choice: ThemeChoice | null, systemPrefersDark: boolean): "light" | "dark" {
  if (choice === "dark") return "dark";
  if (choice === "system" && systemPrefersDark) return "dark";
  return "light";
}

// Runs in the browser before the first paint (inlined by app/layout.tsx), so it
// is written without modules and kept to a few lines. It sets the attribute the
// dark stylesheet keys on, and nothing else.
export const THEME_INIT_SCRIPT = [
  "(function(){try{",
  `var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);`,
  "var c=m?m[1]:'';",
  `if(location.pathname.indexOf('${ORG_APP_PATH}')===0){`,
  `var dark=c==='dark'||(c==='system'&&window.matchMedia&&window.matchMedia('${DARK_QUERY}').matches);`,
  `if(dark)document.documentElement.setAttribute('${THEME_ATTRIBUTE}','dark');`,
  "}}catch(e){}})();",
].join("");
