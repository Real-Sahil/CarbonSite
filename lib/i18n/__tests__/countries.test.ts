import { describe, expect, it } from "vitest";
import { COUNTRIES, CURRENCIES, countryOf, currencyForCountry } from "../countries";
import { localeForCountry } from "../org-format";

describe("countries", () => {
  it("suggests each country's currency, any case", () => {
    expect(currencyForCountry("GB")).toBe("GBP");
    expect(currencyForCountry("de")).toBe("EUR");
    expect(currencyForCountry("AE")).toBe("AED");
  });
  it("returns nothing for an unknown or missing country", () => {
    expect(currencyForCountry("ZZ")).toBeUndefined();
    expect(currencyForCountry(null)).toBeUndefined();
    expect(countryOf("United Kingdom")).toBeUndefined();
  });
  it("has unique codes, three-letter currencies, and a locale for each", () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    for (const c of COUNTRIES) {
      expect(c.currency).toMatch(/^[A-Z]{3}$/);
      expect(localeForCountry(c.code)).toBeTruthy();
    }
    expect(CURRENCIES).toContain("EUR");
  });
});

describe("createOrgSchema country and currency", async () => {
  const { createOrgSchema } = await import("@/lib/validation/org");
  it("keeps a listed country, upper-cased, and a valid currency", () => {
    const r = createOrgSchema.parse({ name: "Acme", hqCountry: "ae", reportingCurrency: "aed" });
    expect(r.hqCountry).toBe("AE");
    expect(r.reportingCurrency).toBe("AED");
  });
  it("drops an unlisted country and a malformed currency instead of refusing", () => {
    const r = createOrgSchema.parse({ name: "Acme", hqCountry: "Narnia", reportingCurrency: "pounds" });
    expect(r.hqCountry).toBeUndefined();
    expect(r.reportingCurrency).toBeUndefined();
  });
});

describe("createOrgSchema fiscal year start month", async () => {
  const { createOrgSchema } = await import("@/lib/validation/org");
  it("keeps 1 to 12 and drops anything else", () => {
    expect(createOrgSchema.parse({ name: "Acme", fiscalYearStartMonth: 4 }).fiscalYearStartMonth).toBe(4);
    expect(createOrgSchema.parse({ name: "Acme", fiscalYearStartMonth: 13 }).fiscalYearStartMonth).toBeUndefined();
  });
});
