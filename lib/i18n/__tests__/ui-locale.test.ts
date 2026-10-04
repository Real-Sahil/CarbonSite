import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";
import { dirOf, mergeMessages, resolveUiLocale, type Messages } from "../ui-locale";

const keys = (m: Messages, prefix = ""): string[] =>
  Object.entries(m).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

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
  it("has an Arabic string for every English key, none empty, and no extra keys", () => {
    expect(keys(ar as Messages).sort()).toEqual(keys(en as Messages).sort());
    for (const k of keys(ar as Messages)) {
      const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], ar);
      expect(String(v).length, k).toBeGreaterThan(0);
    }
  });
  it("shows a string a translation lacks in English, key by key", () => {
    const merged = mergeMessages({ a: { x: "X", y: "Y" }, b: "B" }, { a: { x: "س" } });
    expect(merged).toEqual({ a: { x: "س", y: "Y" }, b: "B" });
  });
});
