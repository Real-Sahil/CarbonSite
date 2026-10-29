import { describe, expect, it } from "vitest";
import { buildSiteCollection, cameraFor, keyOf, selectedFilter, type PlacedSite } from "@/lib/map/tiles-data";

const site = (over: Partial<PlacedSite>): PlacedSite =>
  ({ id: "a", name: "Alpha", kind: "site", kg: 1000, recordCount: 1, latitude: 51.5, longitude: -0.1, ...over }) as PlacedSite;
const colours = { site: "#111111", facility: "#222222" };
const fmt = (kg: number) => `${kg / 1000} t`;

describe("keyOf", () => {
  it("prefixes the kind and defaults to facility", () => {
    expect(keyOf(site({ id: "x" }))).toBe("site:x");
    expect(keyOf(site({ id: "y", kind: undefined }))).toBe("facility:y");
  });
});

describe("buildSiteCollection", () => {
  it("puts longitude first and labels with the formatter", () => {
    const f = buildSiteCollection([site({ longitude: -2, latitude: 53 })], fmt, colours).features[0];
    expect(f.geometry.coordinates).toEqual([-2, 53]);
    expect(f.properties.label).toBe("Alpha: 1 t");
    expect(f.properties.key).toBe("site:a");
  });

  it("colours sites and offices differently", () => {
    const c = buildSiteCollection([site({}), site({ id: "b", kind: "facility" })], fmt, colours);
    expect(c.features.map((f) => f.properties.colour)).toEqual(["#111111", "#222222"]);
  });

  it("sizes the biggest pin largest and never gives a zero-emission pin a negative radius", () => {
    const c = buildSiteCollection([site({ kg: 0 }), site({ id: "b", kg: 5000 })], fmt, colours);
    const [small, big] = c.features.map((f) => f.properties.r);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(0);
  });

  it("returns an empty collection for no sites", () => {
    expect(buildSiteCollection([], fmt, colours).features).toEqual([]);
  });
});

describe("selectedFilter", () => {
  it("lists the selected keys", () => {
    expect(selectedFilter("site:a|facility:b")).toEqual(["in", ["get", "key"], ["literal", ["site:a", "facility:b"]]]);
  });
  it("matches nothing when nothing is selected", () => {
    expect(selectedFilter("")).toEqual(["in", ["get", "key"], ["literal", []]]);
  });
});

describe("cameraFor", () => {
  it("fits several pins", () => {
    const cam = cameraFor(buildSiteCollection([site({}), site({ id: "b", longitude: -3 })], fmt, colours));
    expect(cam).toMatchObject({ kind: "bounds", padding: 50, maxZoom: 11 });
    expect(cam.kind === "bounds" && cam.points).toHaveLength(2);
  });
  it("centres on a single pin", () => {
    expect(cameraFor(buildSiteCollection([site({ longitude: -3, latitude: 52 })], fmt, colours))).toEqual({ kind: "centre", centre: [-3, 52], zoom: 10 });
  });
  it("leaves the default view when there are no pins", () => {
    expect(cameraFor(buildSiteCollection([], fmt, colours))).toEqual({ kind: "none" });
  });
});
