import { describe, expect, it } from "vitest";
import { regionOf, relevantRegions } from "../regions";

describe("regions", () => {
  it("maps countries to loaded regions", () => {
    expect(regionOf("gb")).toBe("uk");
    expect(regionOf("DE")).toBe("eu");
    expect(regionOf("AE")).toBe("uae");
    expect(regionOf("US")).toBe("us");
    expect(regionOf("NO")).toBeNull();
    expect(regionOf(null)).toBeNull();
  });
  it("unions the HQ and facility countries and lists those with no rules loaded", () => {
    const r = relevantRegions("GB", ["IE", "IE", "AE", "US", "NO", null, "Narnia"]);
    expect(r.regions.sort()).toEqual(["eu", "uae", "uk", "us"]);
    expect(r.unloaded).toEqual(["NO"]);
  });
  it("reads names and aliases a user typed on a facility", () => {
    expect(regionOf("United Kingdom")).toBe("uk");
    expect(regionOf("UK")).toBe("uk");
    expect(regionOf("Germany")).toBe("eu");
    expect(relevantRegions(null, ["Ireland", "United Arab Emirates"]).regions.sort()).toEqual(["eu", "uae"]);
  });
  it("is empty for an organisation with no country", () => {
    expect(relevantRegions(null, [])).toEqual({ regions: [], unloaded: [] });
  });
});
