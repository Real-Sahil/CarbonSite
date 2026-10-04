import { describe, expect, it } from "vitest";
import { regionOf, relevantRegions } from "../regions";

describe("regions", () => {
  it("maps countries to loaded regions", () => {
    expect(regionOf("gb")).toBe("uk");
    expect(regionOf("DE")).toBe("eu");
    expect(regionOf("AE")).toBe("uae");
    expect(regionOf("US")).toBe("us");
    expect(regionOf("AU")).toBe("au");
    expect(regionOf("ca")).toBe("ca");
    expect(regionOf("NO")).toBeNull();
    expect(regionOf(null)).toBeNull();
  });
  it("unions the HQ and facility countries and lists those with no rules loaded", () => {
    const r = relevantRegions("GB", ["IE", "IE", "AE", "US", "NO", null, "Narnia"]);
    expect(r.regions.sort()).toEqual(["eu", "uae", "uk", "us"]);
    expect(r.unloaded).toEqual(["NO"]);
  });
  it("adds Germany's national rules beside the EU's", () => {
    expect(relevantRegions("DE", []).regions.sort()).toEqual(["de", "eu"]);
    expect(relevantRegions("AU", ["CA"]).regions.sort()).toEqual(["au", "ca"]);
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
