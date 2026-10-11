import { describe, expect, it } from "vitest";
import { brandingCss, brandingVars, contrastWithWhite, normaliseHex } from "../css-vars";

describe("normaliseHex", () => {
  it("accepts six-digit hex with or without #, lower-cased", () => {
    expect(normaliseHex("#C2410C")).toBe("#c2410c");
    expect(normaliseHex("c2410c")).toBe("#c2410c");
  });

  it("rejects anything that could leave a style value", () => {
    expect(normaliseHex("red")).toBeNull();
    expect(normaliseHex("#fff")).toBeNull();
    expect(normaliseHex("#c2410c; background:url(x)")).toBeNull();
    expect(normaliseHex(null)).toBeNull();
  });
});

describe("contrastWithWhite", () => {
  it("matches the WCAG value for white and black", () => {
    expect(contrastWithWhite("#ffffff")).toBeCloseTo(1, 3);
    expect(contrastWithWhite("#000000")).toBeCloseTo(21, 3);
  });

  it("puts the product orange above AA for button text", () => {
    expect(contrastWithWhite("#c2410c")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("brandingVars", () => {
  it("returns nothing without a branding row", () => {
    expect(brandingVars(null)).toEqual({});
  });

  it("uses a tenant primary that passes contrast", () => {
    const vars = brandingVars({ primaryHex: "#1d4ed8", accentHex: null, fontFamily: null });
    expect(vars["--color-primary"]).toBe("#1d4ed8");
    expect(vars["--color-brand-primary"]).toBe("#1d4ed8");
  });

  it("keeps the product orange for the schema default colour", () => {
    const vars = brandingVars({ primaryHex: "#0f4c8a", accentHex: null, fontFamily: null });
    expect(vars["--color-primary"]).toBeUndefined();
  });

  it("keeps the product orange for a primary too light for white text", () => {
    const vars = brandingVars({ primaryHex: "#fbbf24", accentHex: null, fontFamily: null });
    expect(vars["--color-primary"]).toBeUndefined();
  });

  it("drops a font that is not in the allow-list", () => {
    const vars = brandingVars({ primaryHex: null, accentHex: null, fontFamily: "Comic Sans; } body{x:y" });
    expect(vars["--font-sans"]).toBeUndefined();
  });

  it("sets the font from the allow-list", () => {
    const vars = brandingVars({ primaryHex: null, accentHex: null, fontFamily: "Lato" });
    expect(vars["--font-sans"]).toBe('"Lato", system-ui, sans-serif');
  });
});

describe("brandingCss", () => {
  it("renders a root block, or nothing when empty", () => {
    expect(brandingCss({})).toBe("");
    expect(brandingCss({ "--color-primary": "#1d4ed8" })).toBe(":root { --color-primary: #1d4ed8; }");
  });
});
