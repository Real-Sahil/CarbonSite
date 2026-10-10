import { describe, expect, it } from "vitest";
import { compareRows, filtersAfterPin, filtersAfterProject, pinFilter, spreadCoincident, toQuery } from "../site-hero";

const office = { kind: "facility" as const, id: "f1", projectId: null };
const site = { kind: "site" as const, id: "s1", projectId: "p1" };
const siteNoProject = { kind: "site" as const, id: "s2", projectId: null };

describe("pinFilter", () => {
  it("filters an office by facility and a project site by that one site, with or without a project", () => {
    expect(pinFilter(office)).toEqual({ key: "facilityId", value: "f1" });
    expect(pinFilter(site)).toEqual({ key: "siteId", value: "s1" });
    expect(pinFilter(siteNoProject)).toEqual({ key: "siteId", value: "s2" });
  });
});

describe("filtersAfterPin", () => {
  it("sets the pin and keeps every other filter", () => {
    expect(filtersAfterPin({ scope: "1", supplier: "certas" }, office)).toEqual({ scope: "1", supplier: "certas", facilityId: "f1" });
  });

  it("replaces an earlier site choice of the other kind, so one site is shown", () => {
    expect(filtersAfterPin({ facilityId: "f4", siteId: "s7" }, office)).toEqual({ facilityId: "f1" });
    expect(filtersAfterPin({ facilityId: "f4" }, site)).toEqual({ siteId: "s1" });
  });

  it("keeps the project when a site inside it is chosen", () => {
    expect(filtersAfterPin({ projectId: "p1" }, site)).toEqual({ projectId: "p1", siteId: "s1" });
  });

  it("clears the site choice when the active pin is chosen again", () => {
    expect(filtersAfterPin({ facilityId: "f1", scope: "2" }, office)).toEqual({ scope: "2" });
    expect(filtersAfterPin({ siteId: "s1" }, site)).toEqual({});
  });
});

describe("filtersAfterProject", () => {
  it("sets a project and drops a facility choice", () => {
    expect(filtersAfterProject({ facilityId: "f1", from: "2026-01" }, "p2")).toEqual({ from: "2026-01", projectId: "p2" });
  });

  it("clears back to all projects with an empty value", () => {
    expect(filtersAfterProject({ projectId: "p2", scope: "1" }, "")).toEqual({ scope: "1" });
  });
});

describe("toQuery", () => {
  it("builds the query string, or nothing when there are no filters", () => {
    expect(toQuery({})).toBe("");
    expect(toQuery({ projectId: "p1", scope: "1" })).toBe("?projectId=p1&scope=1");
  });
});

describe("spreadCoincident", () => {
  it("leaves separate pins where they are", () => {
    const pts = [{ x: 100, y: 100 }, { x: 300, y: 200 }];
    expect(spreadCoincident(pts)).toEqual(pts);
  });

  it("spreads pins that share a spot into a ring, apart from each other", () => {
    const out = spreadCoincident([{ x: 360, y: 150 }, { x: 360, y: 150 }, { x: 360, y: 150 }]);
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    expect(d(out[0], out[1])).toBeGreaterThan(20);
    expect(d(out[1], out[2])).toBeGreaterThan(20);
    expect(d(out[0], { x: 360, y: 150 })).toBeCloseTo(26, 0);
  });
});

describe("compareRows", () => {
  const a = { id: "a", name: "Alpha", kind: "site" as const, kg: 300, recordCount: 2, latitude: null, longitude: null };
  const b = { id: "b", name: "Bravo", kind: "site" as const, kg: 100, recordCount: 9, latitude: null, longitude: null };
  const o = { id: "o", name: "Depot", kind: "facility" as const, kg: 500, recordCount: 1, latitude: null, longitude: null };
  it("shares are within the same kind, never across kinds", () => {
    const rows = compareRows([a, b, o], "kg", "desc");
    expect(rows.map((r) => r.site.id)).toEqual(["o", "a", "b"]);
    expect(rows.find((r) => r.site.id === "a")!.share).toBeCloseTo(0.75);
    expect(rows.find((r) => r.site.id === "o")!.share).toBe(1);
  });
  it("sorts by name and records in either direction", () => {
    expect(compareRows([b, a], "name", "asc").map((r) => r.site.id)).toEqual(["a", "b"]);
    expect(compareRows([a, b], "recordCount", "desc").map((r) => r.site.id)).toEqual(["b", "a"]);
  });
});
