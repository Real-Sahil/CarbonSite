import { describe, expect, it } from "vitest";
import { MESSAGES, dirOf, resolveUiLocale, t } from "../ui-locale";

describe("ui locale", () => {
  it("is right to left only for Arabic", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });
  it("shows Arabic only when enabled and asked for", () => {
    expect(resolveUiLocale("ar", true)).toBe("ar");
    expect(resolveUiLocale("ar", false)).toBe("en");
    expect(resolveUiLocale("fr", true)).toBe("en");
    expect(resolveUiLocale(undefined, true)).toBe("en");
  });
  it("has an Arabic string for every English key, none empty", () => {
    for (const key of Object.keys(MESSAGES.en) as (keyof typeof MESSAGES.en)[]) {
      expect(MESSAGES.ar[key]?.length).toBeGreaterThan(0);
      expect(t("ar", key)).toBe(MESSAGES.ar[key]);
    }
  });
});
