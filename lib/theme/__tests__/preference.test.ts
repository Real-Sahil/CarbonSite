import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, parseThemeChoice, resolveTheme } from "../preference";

describe("parseThemeChoice", () => {
  it("accepts the three choices and nothing else", () => {
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice("dark")).toBe("dark");
    expect(parseThemeChoice("system")).toBe("system");
    expect(parseThemeChoice("Dark")).toBeNull();
    expect(parseThemeChoice(null)).toBeNull();
    expect(parseThemeChoice(1)).toBeNull();
  });

  it("never reads an inherited property as a choice", () => {
    expect(parseThemeChoice("constructor")).toBeNull();
    expect(parseThemeChoice("__proto__")).toBeNull();
  });
});

describe("resolveTheme", () => {
  it("is light by default, whatever the OS says", () => {
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("is dark when chosen, whatever the OS says", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS only for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

// The init script runs before the first paint, so it is exercised with fake
// document, location and window objects rather than a DOM.
function run(cookie: string, pathname: string, systemPrefersDark: boolean) {
  const attrs: Record<string, string> = {};
  const doc = {
    cookie,
    documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
  };
  const win = { matchMedia: () => ({ matches: systemPrefersDark }) };
  new Function("document", "location", "window", THEME_INIT_SCRIPT)(doc, { pathname }, win);
  return attrs;
}

describe("THEME_INIT_SCRIPT", () => {
  it("sets dark under the org app when the cookie says dark", () => {
    expect(run("metricora-theme=dark", "/orgs/org-a/dashboard", false)).toEqual({ "data-theme": "dark" });
  });

  it("sets dark for system when the OS prefers dark", () => {
    expect(run("metricora-theme=system", "/orgs/org-a", true)).toEqual({ "data-theme": "dark" });
    expect(run("metricora-theme=system", "/orgs/org-a", false)).toEqual({});
  });

  it("leaves light alone and sets nothing without a cookie", () => {
    expect(run("metricora-theme=light", "/orgs/org-a", true)).toEqual({});
    expect(run("", "/orgs/org-a", true)).toEqual({});
  });

  it("never darkens the marketing or auth pages", () => {
    expect(run("metricora-theme=dark", "/", false)).toEqual({});
    expect(run("metricora-theme=dark", "/sign-in", false)).toEqual({});
  });

  it("finds the cookie among others", () => {
    expect(run("a=1; metricora-theme=dark; b=2", "/orgs/org-a", false)).toEqual({ "data-theme": "dark" });
  });
});
