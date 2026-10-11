import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDarkCss, collectHexTokens, darkLightness, findHexTokens, hexTokenRule, invertHex, paletteDarkDeclarations } from "../dark-css";

const root = process.cwd();
const themeCss = readFileSync(join(root, "node_modules/tailwindcss/theme.css"), "utf8");

describe("darkLightness", () => {
  it("maps black to white and mid-grey to itself", () => {
    expect(darkLightness(0)).toBe(1);
    expect(darkLightness(0.5)).toBe(0.5);
  });

  it("keeps the near-white surfaces as a dark ladder, whiter a little lighter", () => {
    expect(darkLightness(0.93)).toBeCloseTo(0.06);
    expect(darkLightness(1)).toBeCloseTo(0.13);
    expect(darkLightness(0.97)).toBeGreaterThan(darkLightness(0.93));
  });
});

describe("invertHex", () => {
  it("inverts black to a light colour and keeps the hue of a saturated one", () => {
    expect(invertHex("#000000")).toBe("#ffffff");
    expect(invertHex("#ffffff")).not.toBe("#ffffff");
    expect(invertHex("#ffffff")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("expands three-digit hex", () => {
    expect(invertHex("#000")).toBe(invertHex("#000000"));
  });
});

describe("paletteDarkDeclarations", () => {
  it("swaps shades: amber-50 takes amber-950's raw value", () => {
    const raw = /--color-amber-950:\s*([^;]+);/.exec(themeCss)?.[1].trim();
    const out = paletteDarkDeclarations(themeCss);
    expect(raw).toBeTruthy();
    expect(out).toContain(`  --color-amber-50: ${raw};`);
  });

  it("inverts white and black", () => {
    const out = paletteDarkDeclarations(themeCss);
    expect(out).toContain(`  --color-white: ${invertHex("#ffffff")};`);
    expect(out).toContain(`  --color-black: ${invertHex("#000000")};`);
  });
});

describe("findHexTokens", () => {
  it("finds arbitrary hex classes with variants and opacity, and ignores palette classes", () => {
    const text = 'class="text-[#111827] hover:bg-[#F8F9FA]/50 bg-red-500 border-[#abc]"';
    expect(findHexTokens(text)).toEqual(["border-[#abc]", "hover:bg-[#F8F9FA]/50", "text-[#111827]"]);
  });

  it("does not match a hex class embedded in a longer identifier", () => {
    expect(findHexTokens("my-text-[#111827]x")).toEqual([]);
  });
});

describe("hexTokenRule", () => {
  it("scopes a plain token to the dark theme", () => {
    expect(hexTokenRule("text-[#111827]")).toBe(
      `[data-theme="dark"] [class~="text-[#111827]"] { color: ${invertHex("#111827")}; }`,
    );
  });

  it("uses the pseudo-class for a state variant", () => {
    expect(hexTokenRule("hover:bg-[#F8F9FA]")).toContain(`[class~="hover:bg-[#F8F9FA]"]:hover {`);
  });

  it("scopes group-hover to an ancestor .group", () => {
    expect(hexTokenRule("group-hover:text-[#111827]")).toContain(`.group:hover [class~="group-hover:text-[#111827]"]`);
  });

  it("writes an opacity suffix as a colour mix", () => {
    expect(hexTokenRule("bg-[#F8F9FA]/50")).toContain(`color-mix(in srgb, ${invertHex("#F8F9FA")} 50%, transparent)`);
  });

  it("refuses a utility it has no dark rule for, so nothing is silently unstyled", () => {
    expect(() => hexTokenRule("grid-cols-[#111827]")).toThrow(/No dark rule for the utility/);
  });

  it("refuses more than one variant", () => {
    expect(() => hexTokenRule("md:hover:bg-[#111827]")).toThrow(/More than one variant/);
  });
});

describe("generated stylesheet", () => {
  it("has a dark rule for every hex class the source uses", () => {
    expect(() => collectHexTokens(root).map(hexTokenRule)).not.toThrow();
  });

  it("is up to date with the source (run pnpm theme:build when this fails)", () => {
    const committed = readFileSync(join(root, "app/dark-theme.generated.css"), "utf8");
    expect(committed).toBe(buildDarkCss(themeCss, collectHexTokens(root)));
  });
});
