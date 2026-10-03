import { describe, expect, it } from "vitest";
import { formatters, localeForCountry, orgFormat } from "../org-format";

describe("localeForCountry", () => {
  it("maps countries to locales and falls back to English (UK)", () => {
    expect(localeForCountry("us")).toBe("en-US");
    expect(localeForCountry("DE")).toBe("de-DE");
    expect(localeForCountry("BR")).toBe("pt-BR");
    expect(localeForCountry("ZZ")).toBe("en-GB");
    expect(localeForCountry(null)).toBe("en-GB");
  });
});

describe("orgFormat", () => {
  it("takes the currency as is and defaults a malformed one", () => {
    expect(orgFormat({ hqCountry: "JP", reportingCurrency: "jpy" })).toEqual({ locale: "ja-JP", currency: "JPY" });
    expect(orgFormat({ hqCountry: "US", reportingCurrency: "dollars" }).currency).toBe("GBP");
  });
});

describe("formatters", () => {
  const d = new Date("2026-10-03T12:00:00Z");
  it("orders day and month the way the locale does", () => {
    expect(formatters({ locale: "en-GB", currency: "GBP" }).date(d)).toBe("3 October 2026");
    expect(formatters({ locale: "en-US", currency: "USD" }).date(d)).toBe("October 3, 2026");
  });
  it("uses the locale's separators", () => {
    expect(formatters({ locale: "en-US", currency: "USD" }).number(1234.5)).toBe("1,234.5");
    expect(formatters({ locale: "de-DE", currency: "EUR" }).number(1234.5)).toBe("1.234,5");
  });
  it("formats tonnes with two decimals under ten and one above", () => {
    const f = formatters({ locale: "en-GB", currency: "GBP" });
    expect(f.tonnes(3.456)).toBe("3.46");
    expect(f.tonnes(1234.56)).toBe("1,234.6");
  });
  it("formats money in the given currency and does not throw on a bad one", () => {
    const f = formatters({ locale: "en-GB", currency: "GBP" });
    expect(f.money(1234)).toContain("1,234");
    expect(f.money(1234, "EUR")).toContain("€");
    expect(f.money(1234, "NOPE?")).toContain("1,234");
  });
  it("formats a fraction as a percentage", () => {
    expect(formatters({ locale: "fr-FR", currency: "EUR" }).percent(0.254)).toMatch(/25,4\s?%/);
  });
});
