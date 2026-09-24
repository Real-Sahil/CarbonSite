import { describe, expect, it } from "vitest";
import { convertCurrency, normalizeUnit, setFxRatesOn } from "../units";
import { deflateSpend } from "../price-index";

describe("spend converted at the rate for its own date", () => {
  setFxRatesOn("2024-03-15", "2024-03-15", { USD: 0.785, EUR: 0.855 });
  setFxRatesOn("2024-03-16", "2024-03-15", { USD: 0.785 }); // Saturday: Friday's rates

  it("uses the dated ECB rate and records which day it came from", () => {
    const n = normalizeUnit(1000, "USD", new Date("2024-03-16T10:00:00Z"));
    expect(n.amount).toBeCloseTo(785);
    expect(n.fx).toMatchObject({ source: "dated", rateDate: "2024-03-15" });
  });

  it("falls back to a non-dated rate when the day was not fetched, and says so", () => {
    const n = normalizeUnit(1000, "USD", new Date("2019-01-02"));
    expect(n.fx?.source).not.toBe("dated");
  });

  it("converts GBP spend to a USD factor's currency at the dated rate", () => {
    const c = convertCurrency(785, "GBP", "USD", new Date("2024-03-15"))!;
    expect(c.amount).toBeCloseTo(1000);
    expect(c.to.source).toBe("dated");
  });
});

describe("spend adjusted to the factor's price year", () => {
  it("deflates later spend so inflation does not add emissions", () => {
    const d = deflateSpend(1000, "USD", 2024, 2012)!;
    expect(d.amount).toBeCloseTo((1000 * 229.594) / 313.689, 6);
    expect(d.warning).toBeUndefined();
  });

  it("leaves same-year spend unchanged", () => {
    expect(deflateSpend(500, "GBP", 2022, 2022)!.amount).toBe(500);
  });

  it("flags years beyond the published index", () => {
    const d = deflateSpend(1000, "GBP", 2031, 2021)!;
    expect(d.warning).toMatch(/No GBP CPI figure yet for 2031; used 2025/);
  });

  it("returns null for a currency without an index", () => {
    expect(deflateSpend(1, "JPY", 2024, 2020)).toBeNull();
  });
});

describe("published price indices", () => {
  it("includes 2025 for GBP (ONS D7BT) and USD (BLS CPI-U)", () => {
    expect(deflateSpend(1000, "GBP", 2025, 2022)!.ratio).toBeCloseTo(121.7 / 138.4, 10);
    expect(deflateSpend(1000, "USD", 2025, 2022)!.ratio).toBeCloseTo(292.655 / 322.115, 10);
    expect(deflateSpend(1000, "USD", 2025, 2022)!.warning).toBeUndefined();
  });

  it("deflates EUR spend with the euro area HICP (Eurostat), e.g. to ADEME's 2023 prices", () => {
    const d = deflateSpend(1000, "EUR", 2025, 2023)!;
    expect(d.ratio).toBeCloseTo(123.15 / 128.75, 10);
    expect(d.amount).toBeCloseTo(956.5, 1);
    expect(d.warning).toBeUndefined();
    expect(deflateSpend(1000, "EUR", 2022, 2015)!.ratio).toBeCloseTo(100 / 116.82, 10);
  });
});
