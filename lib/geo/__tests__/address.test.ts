import { describe, expect, it, vi } from "vitest";
import { GeocoderUnavailable, plusCode, suggestAddresses, toSuggestion } from "../address";

describe("toSuggestion", () => {
  it("builds the street line, takes the country code upper-case, and falls back from city to town", () => {
    expect(toSuggestion({ formatted: "10 High St, Reading RG1 1AA, United Kingdom", housenumber: "10", street: "High St", town: "Reading", state: "England", postcode: "RG1 1AA", country_code: "gb", lat: 51.45, lon: -0.97 })).toEqual({
      label: "10 High St, Reading RG1 1AA, United Kingdom", addressLine: "10 High St", city: "Reading", region: "England", postcode: "RG1 1AA", country: "GB", latitude: 51.45, longitude: -0.97,
    });
  });
  it("drops a result with no position", () => {
    expect(toSuggestion({ formatted: "Somewhere" })).toBeNull();
  });
});

describe("suggestAddresses", () => {
  const ok = (body: unknown) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as Response);
  it("sends the text, a country filter and the key to Geoapify only, and maps the results", async () => {
    const f = ok({ results: [{ formatted: "Mussafah, Abu Dhabi", country_code: "ae", lat: 24.35, lon: 54.5 }, { formatted: "no position" }] });
    const out = await suggestAddresses(" Mussafah ", { country: "AE", apiKey: "k", fetchImpl: f as never });
    const url = new URL((f.mock.calls[0] as unknown as [string])[0]);
    expect(url.host).toBe("api.geoapify.com");
    expect(url.searchParams.get("text")).toBe("Mussafah");
    expect(url.searchParams.get("filter")).toBe("countrycode:ae");
    expect(out).toHaveLength(1);
    expect(out[0].country).toBe("AE");
  });
  it("ignores a malformed country instead of passing it on", async () => {
    const f = ok({ results: [] });
    await suggestAddresses("x y", { country: "United Kingdom", apiKey: "k", fetchImpl: f as never });
    expect(new URL((f.mock.calls[0] as unknown as [string])[0]).searchParams.has("filter")).toBe(false);
  });
  it("says so with no key, or when the service fails", async () => {
    const prev = process.env.GEOAPIFY_API_KEY;
    delete process.env.GEOAPIFY_API_KEY;
    await expect(suggestAddresses("abc")).rejects.toBeInstanceOf(GeocoderUnavailable);
    if (prev) process.env.GEOAPIFY_API_KEY = prev;
    const bad = vi.fn(async () => ({ ok: false, status: 429 }) as Response);
    await expect(suggestAddresses("abc", { apiKey: "k", fetchImpl: bad as never })).rejects.toBeInstanceOf(GeocoderUnavailable);
    const down = vi.fn(async () => { throw new Error("net"); });
    await expect(suggestAddresses("abc", { apiKey: "k", fetchImpl: down as never })).rejects.toBeInstanceOf(GeocoderUnavailable);
  });
});

describe("plusCode", () => {
  it("matches published Open Location Code examples to the first eight digits", () => {
    // 20.375,2.775 is the specification's own example: 7FG49Q00+ at 6 digits.
    expect(plusCode(20.375, 2.775).slice(0, 6)).toBe("7FG49Q");
    expect(plusCode(37.4220, -122.0841).slice(0, 8)).toBe("849VCWC8");
  });
});
