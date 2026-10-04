import { describe, expect, it } from "vitest";
import { currencySymbol, formatMoney } from "../org-format";

describe("currency display", () => {
  it("writes the symbol people use in their own locale", () => {
    expect(currencySymbol("GBP", "en-GB")).toBe("£");
    expect(currencySymbol("EUR", "fr-FR")).toBe("€");
    expect(currencySymbol("USD", "en-US")).toBe("$");
    expect(currencySymbol("JPY", "ja-JP")).toMatch(/[¥￥]/);
    expect(currencySymbol("CHF", "de-CH")).toBe("CHF");
    expect(currencySymbol("not-a-code")).toBe("not-a-code");
  });
  it("rounds to whole units by default and to cents on request", () => {
    expect(formatMoney(1234.56, "GBP", "en-GB")).toBe("£1,235");
    expect(formatMoney(1234.56, "GBP", "en-GB", 2)).toBe("£1,234.56");
    expect(formatMoney(1234.5, "AUD", "en-AU", 2)).toBe("$1,234.50");
  });
  it("never throws on a bad currency", () => {
    expect(formatMoney(10, "??", "en-GB")).toBe("?? 10");
  });
});
