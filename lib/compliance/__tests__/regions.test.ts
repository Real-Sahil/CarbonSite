import { describe, expect, it } from "vitest";
import { regionOf, relevantRegions } from "../regions";

describe("regions", () => {
  it("maps countries to loaded regions", () => {
    expect(regionOf("gb")).toBe("uk");
    expect(regionOf("DE")).toBe("eu");
    expect(regionOf("AE")).toBe("uae");
    expect(regionOf("US")).toBeNull();
    expect(regionOf("NO")).toBeNull();
    expect(regionOf(null)).toBeNull();
  });
  it("unions the HQ and facility countries and lists those with no rules loaded", () => {
    const r = relevantRegions("GB", ["IE", "IE", "AE", "US", null, "Narnia"]);
    expect(r.regions.sort()).toEqual(["eu", "uae", "uk"]);
    expect(r.unloaded).toEqual(["US"]);
  });
  it("is empty for an organisation with no country", () => {
    expect(relevantRegions(null, [])).toEqual({ regions: [], unloaded: [] });
  });
});
