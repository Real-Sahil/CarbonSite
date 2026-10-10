import { describe, expect, it } from "vitest";
import { filtersAfterPin, filtersAfterProject, pinFilter, spreadCoincident, toQuery } from "../site-hero";

const office = { kind: "facility" as const, id: "f1", projectId: null };
const site = { kind: "site" as const, id: "s1", projectId: "p1" };
const siteNoProject = { kind: "site" as const, id: "s2", projectId: null };

describe("pinFilter", () => {
  it("filters an office by facility and a project site by its project", () => {
    expect(pinFilter(office)).toEqual({ key: "facilityId", value: "f1" });
    expect(pinFilter(site)).toEqual({ key: "projectId", value: "p1" });
  });

  it("does not offer a project site that has no project", () => {
    expect(pinFilter(siteNoProject)).toBeNull();
  });
});

describe("filtersAfterPin", () => {
  it("sets the pin and keeps every other filter", () => {
    expect(filtersAfterPin({ scope: "1", supplier: "certas" }, office)).toEqual({ scope: "1", supplier: "certas", facilityId: "f1" });
  });

  it("replaces an earlier site choice of the other kind, so one site is shown", () => {
    expect(filtersAfterPin({ projectId: "p9", facilityId: "f4" }, office)).toEqual({ facilityId: "f1" });
    expect(filtersAfterPin({ facilityId: "f4" }, site)).toEqual({ projectId: "p1" });
  });

  it("clears the site choice when the active pin is chosen again", () => {
    expect(filtersAfterPin({ facilityId: "f1", scope: "2" }, office)).toEqual({ scope: "2" });
  });

  it("leaves the filters alone for a project site with no project", () => {
    expect(filtersAfterPin({ facilityId: "f1", scope: "2" }, siteNoProject)).toEqual({ scope: "2" });
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
